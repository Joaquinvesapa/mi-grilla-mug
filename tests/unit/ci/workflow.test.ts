import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const WORKFLOW_PATH = resolve(process.cwd(), ".github/workflows/ci.yml");
const PACKAGE_JSON_PATH = resolve(process.cwd(), "package.json");
const COMPOSE_PATH = resolve(process.cwd(), "docker-compose.yml");
const MAX_TIMEOUT_MINUTES = 10;
const PINNED_USES = /^[^@\s]+@[0-9a-f]{40}$/;
/** Postgres 17 pinned to a minor (`postgres:17.12`), never the floating `postgres:17`. */
const PINNED_POSTGRES = /^postgres:17\.\d+$/;
/** On `push` to main the run is never cancelled: two merges in a row each get a full run. */
const CANCEL_ONLY_PULL_REQUESTS = "${{ github.event_name == 'pull_request' }}";
const PLAYWRIGHT_CACHE_KEY =
  /^playwright-\$\{\{\s*runner\.os\s*\}\}-\$\{\{\s*steps\.([\w-]+)\.outputs\.([\w-]+)\s*\}\}$/;

type Step = {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
} & Record<string, unknown>;
type Job = {
  "timeout-minutes"?: unknown;
  needs?: unknown;
  uses?: string;
  env?: Record<string, unknown>;
  services?: Record<string, { image?: string } & Record<string, unknown>>;
  permissions?: unknown;
  steps?: Step[];
} & Record<string, unknown>;
type Workflow = {
  on?: Record<string, unknown>;
  permissions?: unknown;
  concurrency?: { group?: string; "cancel-in-progress"?: unknown };
  jobs?: Record<string, Job>;
} & Record<string, unknown>;

function readWorkflowText(): string {
  expect(existsSync(WORKFLOW_PATH), "no existe .github/workflows/ci.yml").toBe(true);
  return readFileSync(WORKFLOW_PATH, "utf8");
}

function readWorkflow(): Workflow {
  return parse(readWorkflowText()) as Workflow;
}

function jobsOf(workflow: Workflow): Record<string, Job> {
  return workflow.jobs ?? {};
}

/** Every `run:` of a job, split into one trimmed command per line. */
function commandsOf(job: Job): string[] {
  return (job.steps ?? [])
    .flatMap((step) => (typeof step.run === "string" ? step.run.split("\n") : []))
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/** Jobs whose `timeout-minutes` is missing, not a number, or outside 1..10 (NFR-04). */
function jobsWithoutValidTimeout(workflow: Workflow): string[] {
  return Object.entries(jobsOf(workflow))
    .filter(([, job]) => {
      const timeout = job["timeout-minutes"];
      return typeof timeout !== "number" || timeout <= 0 || timeout > MAX_TIMEOUT_MINUTES;
    })
    .map(([name]) => name);
}

/** Every `uses:` (steps and reusable-workflow jobs) not pinned to a 40-char commit SHA (R-10). */
function unpinnedUses(workflow: Workflow): string[] {
  return Object.values(jobsOf(workflow))
    .flatMap((job) => [job.uses, ...(job.steps ?? []).map((step) => step.uses)])
    .filter((uses): uses is string => typeof uses === "string")
    .filter((uses) => !uses.startsWith("./") && !PINNED_USES.test(uses));
}

/** Jobs with an `actions/checkout` step that does not set `persist-credentials: false` (R-09). */
function checkoutsPersistingCredentials(workflow: Workflow): string[] {
  return Object.entries(jobsOf(workflow))
    .filter(([, job]) =>
      (job.steps ?? []).some(
        (step) =>
          step.uses?.startsWith("actions/checkout@") === true &&
          step.with?.["persist-credentials"] !== false,
      ),
    )
    .map(([name]) => name);
}

/** Jobs with a `run:` that interpolates `${{ github.event.* }}` — script injection (R-09). */
function runsInterpolatingEvent(workflow: Workflow): string[] {
  return Object.entries(jobsOf(workflow))
    .filter(([, job]) =>
      (job.steps ?? []).some(
        (step) => typeof step.run === "string" && /\$\{\{\s*github\.event\./.test(step.run),
      ),
    )
    .map(([name]) => name);
}

/** `job` or `job/<step index>` for every job or step that declares `continue-on-error`. */
function continueOnErrorAt(workflow: Workflow): string[] {
  return Object.entries(jobsOf(workflow)).flatMap(([name, job]) => [
    ...("continue-on-error" in job ? [name] : []),
    ...(job.steps ?? []).flatMap((step, index) =>
      "continue-on-error" in step ? [`${name}/${index}`] : [],
    ),
  ]);
}

/**
 * `job` or `job/<step index>` for every `if` other than `if: failure()` on upload-artifact. A
 * skipped job or step counts as passed for a required check.
 */
function conditionsAt(workflow: Workflow): string[] {
  return Object.entries(jobsOf(workflow)).flatMap(([name, job]) => [
    ...("if" in job ? [name] : []),
    ...(job.steps ?? []).flatMap((step, index) => {
      if (!("if" in step)) return [];
      const allowed =
        step.uses?.startsWith("actions/upload-artifact@") === true && step.if === "failure()";
      return allowed ? [] : [`${name}/${index}`];
    }),
  ]);
}

/**
 * Jobs (keys of `suites`) where `pnpm db:seed` is missing or not between `pnpm db:migrate` and the
 * job's suite command: the suites read the grid from the database, so it has to be there first.
 */
function jobsSeedingOutOfOrder(workflow: Workflow, suites: Record<string, string>): string[] {
  const jobs = jobsOf(workflow);
  return Object.entries(suites)
    .filter(([name, suite]) => {
      const commands = commandsOf(jobs[name] ?? {});
      const migrate = commands.indexOf("pnpm db:migrate");
      const seed = commands.indexOf("pnpm db:seed");
      const run = commands.indexOf(suite);
      return migrate < 0 || seed < 0 || run < 0 || !(migrate < seed && seed < run);
    })
    .map(([name]) => name);
}

function composePostgresImage(): unknown {
  const compose = parse(readFileSync(COMPOSE_PATH, "utf8")) as {
    services?: Record<string, { image?: unknown }>;
  };
  return compose.services?.postgres?.image;
}

describe("CI workflow — triggers y permisos (AC-08, AC-09, AC-10, R-09)", () => {
  it("corre solo en pull_request (opened, synchronize, reopened) y en push a main", () => {
    const workflow = readWorkflow();
    const on = workflow.on ?? {};

    expect(Object.keys(on).sort()).toEqual(["pull_request", "push"]);
    expect(on).not.toHaveProperty("pull_request_target");
    const pullRequest = on.pull_request as { types?: string[] };
    expect([...(pullRequest.types ?? [])].sort()).toEqual(["opened", "reopened", "synchronize"]);
    expect(on.push).toEqual({ branches: ["main"] });
  });

  it("el GITHUB_TOKEN solo lee el contenido, y ningún job pide más", () => {
    const workflow = readWorkflow();

    expect(workflow.permissions).toEqual({ contents: "read" });
    const readOnly = JSON.stringify({ contents: "read" });
    const escalated = Object.entries(jobsOf(workflow))
      .filter(([, job]) => job.permissions !== undefined)
      .filter(([, job]) => JSON.stringify(job.permissions) !== readOnly)
      .map(([name]) => name);
    expect(escalated, "jobs que piden más permisos que contents: read").toEqual([]);
  });

  it("una corrida nueva sobre el mismo PR cancela la anterior; en main nunca se cancela", () => {
    const workflow = readWorkflow();

    expect(workflow.concurrency?.group).toMatch(/\$\{\{\s*github\.ref\s*\}\}/);
    // `true` a secas cancelaría la corrida de un merge a main cuando llega el siguiente.
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(CANCEL_ONLY_PULL_REQUESTS);
  });

  it("cada actions/checkout tiene persist-credentials: false; uno sin él es rechazado", () => {
    const broken: Workflow = {
      jobs: {
        a: { steps: [{ uses: "actions/checkout@x", with: { "persist-credentials": false } }] },
        b: { steps: [{ uses: "actions/checkout@y" }] },
        c: { steps: [{ uses: "actions/checkout@z", with: { "persist-credentials": "false" } }] },
      },
    };
    expect(checkoutsPersistingCredentials(broken)).toEqual(["b", "c"]);

    const workflow = readWorkflow();
    const checkouts = Object.values(jobsOf(workflow)).flatMap((job) =>
      (job.steps ?? []).filter((step) => step.uses?.startsWith("actions/checkout@")),
    );
    expect(checkouts.length).toBe(Object.keys(jobsOf(workflow)).length);
    expect(checkoutsPersistingCredentials(workflow)).toEqual([]);
  });

  it("ningún `run:` interpola ${{ github.event.* }}; uno que lo hace es rechazado", () => {
    const broken: Workflow = {
      jobs: {
        ok: { steps: [{ run: "echo ${{ runner.os }}" }] },
        title: { steps: [{ run: 'echo "${{ github.event.pull_request.title }}"' }] },
        spaced: { steps: [{ run: "echo ${{github.event.head_commit.message}}" }] },
      },
    };
    expect(runsInterpolatingEvent(broken)).toEqual(["title", "spaced"]);

    expect(runsInterpolatingEvent(readWorkflow())).toEqual([]);
  });
});

describe("CI workflow — un check requerido no puede quedar aprobado sin correr (AC-11)", () => {
  it("ningún job ni step tiene continue-on-error, con ningún valor; uno que lo tiene es rechazado", () => {
    const broken: Workflow = {
      jobs: {
        ok: { steps: [{ run: "pnpm lint" }] },
        job: { "continue-on-error": false, steps: [] },
        step: { steps: [{ run: "pnpm test", "continue-on-error": true }] },
      },
    };
    expect(continueOnErrorAt(broken)).toEqual(["job", "step/0"]);

    expect(continueOnErrorAt(readWorkflow())).toEqual([]);
  });

  it("ningún job ni step tiene `if`, salvo upload-artifact con exactamente if: failure()", () => {
    const broken: Workflow = {
      jobs: {
        ok: {
          steps: [{ run: "pnpm test" }, { uses: "actions/upload-artifact@x", if: "failure()" }],
        },
        job: { if: "github.event_name == 'push'", steps: [] },
        step: { steps: [{ run: "pnpm test", if: "always()" }] },
        artifact: { steps: [{ uses: "actions/upload-artifact@x", if: "always()" }] },
      },
    };
    expect(conditionsAt(broken)).toEqual(["job", "step/0", "artifact/0"]);

    const workflow = readWorkflow();
    expect(conditionsAt(workflow)).toEqual([]);
    const artifacts = Object.values(jobsOf(workflow)).flatMap((job) =>
      (job.steps ?? []).filter((step) => step.uses?.startsWith("actions/upload-artifact@")),
    );
    expect(artifacts.length).toBeGreaterThan(0);
    for (const artifact of artifacts) {
      expect(artifact.if).toBe("failure()");
    }
  });
});

describe("CI workflow — jobs (AC-08)", () => {
  const scripts = (
    JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
      scripts: Record<string, string>;
    }
  ).scripts;

  it("tiene los jobs quality, integration y e2e, en paralelo (ninguno espera a otro)", () => {
    const jobs = jobsOf(readWorkflow());

    expect(Object.keys(jobs).sort()).toEqual(["e2e", "integration", "quality"]);
    for (const [name, job] of Object.entries(jobs)) {
      expect(job.needs, `${name} no debería esperar a otro job`).toBeUndefined();
    }
  });

  it("quality instala con el lockfile congelado, sin DATABASE_URL, y corre lint, formato, tipos y unit con coverage", () => {
    const quality = jobsOf(readWorkflow()).quality;
    expect(quality, "falta el job quality").toBeDefined();
    const commands = commandsOf(quality!);

    expect(commands).toEqual(
      expect.arrayContaining([
        "pnpm install --frozen-lockfile",
        "pnpm lint",
        "pnpm format:check",
        "pnpm typecheck",
        "pnpm test",
      ]),
    );
    expect(JSON.stringify(quality), "quality no debería tener DATABASE_URL").not.toContain(
      "DATABASE_URL",
    );
    // `pnpm test` is the unit suite with coverage and the 80/70/80 floors (NFR-05).
    expect(scripts.test).toContain("--coverage");
  });

  it("la imagen de Postgres está fijada a un minor de la 17, la misma en la CI y en docker-compose.yml", () => {
    // Guard: the floating major and another major are rejected.
    expect("postgres:17").not.toMatch(PINNED_POSTGRES);
    expect("postgres:18.1").not.toMatch(PINNED_POSTGRES);
    expect("postgres:17.12").toMatch(PINNED_POSTGRES);

    const composeImage = composePostgresImage();
    expect(String(composeImage)).toMatch(PINNED_POSTGRES);
    const ciImages = Object.values(jobsOf(readWorkflow()))
      .map((job) => job.services?.postgres?.image)
      .filter((image) => image !== undefined);
    expect(ciImages.length).toBe(2);
    for (const image of ciImages) {
      expect(image).toMatch(PINNED_POSTGRES);
      expect(image).toBe(composeImage);
    }
  });

  it("integration corre las migraciones y la suite de integración contra un postgres:17.N", () => {
    const integration = jobsOf(readWorkflow()).integration;
    expect(integration, "falta el job integration").toBeDefined();

    expect(integration!.services?.postgres?.image).toMatch(PINNED_POSTGRES);
    expect(commandsOf(integration!)).toEqual(
      expect.arrayContaining([
        "pnpm install --frozen-lockfile",
        "pnpm db:migrate",
        "pnpm test:integration",
      ]),
    );
    expect(JSON.stringify(integration!.env ?? {})).toContain("DATABASE_URL");
  });

  it("e2e instala WebKit y Chromium con sus dependencias, corre Playwright y sube el reporte si falla", () => {
    const e2e = jobsOf(readWorkflow()).e2e;
    expect(e2e, "falta el job e2e").toBeDefined();

    expect(e2e!.services?.postgres?.image).toMatch(PINNED_POSTGRES);
    expect(commandsOf(e2e!)).toEqual(
      expect.arrayContaining([
        "pnpm install --frozen-lockfile",
        "pnpm exec playwright install --with-deps webkit chromium",
        "pnpm test:e2e",
      ]),
    );

    const steps = e2e!.steps ?? [];
    const browserCache = steps.find((step) => step.uses?.startsWith("actions/cache@"));
    expect(browserCache, "falta la cache de los navegadores de Playwright").toBeDefined();
    expect(String(browserCache!.with?.path)).toContain("ms-playwright");
    // La key depende de la versión de @playwright/test, no del lockfile entero.
    const key = String(browserCache!.with?.key);
    expect(key).not.toContain("hashFiles");
    const [, stepId, output] = PLAYWRIGHT_CACHE_KEY.exec(key) ?? [];
    expect(stepId, `key con forma inesperada: ${key}`).toBeDefined();
    const versionStep = steps.find((step) => step.id === stepId);
    expect(versionStep, `falta el step con id ${stepId}`).toBeDefined();
    expect(steps.indexOf(versionStep!)).toBeLessThan(steps.indexOf(browserCache!));
    expect(versionStep!.run).toContain("@playwright/test");
    expect(versionStep!.run).toContain(`${output}=`);
    expect(versionStep!.run).toContain("$GITHUB_OUTPUT");

    const report = steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    expect(report, "falta subir playwright-report").toBeDefined();
    expect(report!.if).toBe("failure()");
    expect(report!.with?.path).toBe("playwright-report");
  });

  it("test-workflow-auth-env: integration y e2e tienen BETTER_AUTH_SECRET y BETTER_AUTH_URL, quality ninguna, y e2e migra antes de correr Playwright", () => {
    const jobs = jobsOf(readWorkflow());
    const AUTH_URLS: Record<string, string> = {
      integration: "http://localhost:3000",
      e2e: "http://127.0.0.1:3100",
    };

    for (const [name, url] of Object.entries(AUTH_URLS)) {
      const env = jobs[name]?.env ?? {};
      const secret = env.BETTER_AUTH_SECRET;
      expect(typeof secret, `${name}: falta BETTER_AUTH_SECRET`).toBe("string");
      // Better Auth (and readAuthEnv) refuse a secret under 32 characters.
      expect(String(secret).length, `${name}: BETTER_AUTH_SECRET corto`).toBeGreaterThanOrEqual(32);
      // A throwaway value written in the file, never a repository secret: forks run without them.
      expect(String(secret), name).not.toMatch(/\$\{\{/);
      expect(env.BETTER_AUTH_URL, `${name}: BETTER_AUTH_URL`).toBe(url);
    }

    // On purpose: quality never needs the secret, so it must not carry one.
    const quality = JSON.stringify(jobs.quality ?? {});
    expect(quality, "quality no debería tener BETTER_AUTH_SECRET").not.toContain(
      "BETTER_AUTH_SECRET",
    );
    expect(quality, "quality no debería tener BETTER_AUTH_URL").not.toContain("BETTER_AUTH_URL");

    const e2eCommands = commandsOf(jobs.e2e ?? {});
    const migrate = e2eCommands.indexOf("pnpm db:migrate");
    expect(migrate, "e2e no corre pnpm db:migrate").toBeGreaterThanOrEqual(0);
    expect(migrate, "e2e migra después de pnpm test:e2e").toBeLessThan(
      e2eCommands.indexOf("pnpm test:e2e"),
    );
  });

  it("test-workflow-seed-step: integration y e2e corren pnpm db:seed después de pnpm db:migrate y antes de la suite; un workflow sin el paso es rechazado", () => {
    const SUITES: Record<string, string> = {
      integration: "pnpm test:integration",
      e2e: "pnpm test:e2e",
    };

    // Guard: a job without the seed, or with it out of order, is rejected.
    const broken: Workflow = {
      jobs: {
        missing: { steps: [{ run: "pnpm db:migrate" }, { run: "pnpm test:integration" }] },
        beforeMigrate: {
          steps: [{ run: "pnpm db:seed" }, { run: "pnpm db:migrate" }, { run: "pnpm test:e2e" }],
        },
        afterSuite: {
          steps: [{ run: "pnpm db:migrate" }, { run: "pnpm test:e2e" }, { run: "pnpm db:seed" }],
        },
        ok: {
          steps: [{ run: "pnpm db:migrate" }, { run: "pnpm db:seed" }, { run: "pnpm test:e2e" }],
        },
      },
    };
    const brokenSuites: Record<string, string> = {
      missing: "pnpm test:integration",
      beforeMigrate: "pnpm test:e2e",
      afterSuite: "pnpm test:e2e",
      ok: "pnpm test:e2e",
    };
    expect(jobsSeedingOutOfOrder(broken, brokenSuites)).toEqual([
      "missing",
      "beforeMigrate",
      "afterSuite",
    ]);

    expect(jobsSeedingOutOfOrder(readWorkflow(), SUITES)).toEqual([]);
    expect(scripts["db:seed"]).toBe("node prisma/seed.ts");
  });

  it("cada job usa Node de .nvmrc y la cache de pnpm", () => {
    for (const [name, job] of Object.entries(jobsOf(readWorkflow()))) {
      const setupNode = (job.steps ?? []).find((step) =>
        step.uses?.startsWith("actions/setup-node@"),
      );
      expect(setupNode, `${name}: falta actions/setup-node`).toBeDefined();
      expect(setupNode!.with, name).toMatchObject({ "node-version-file": ".nvmrc", cache: "pnpm" });
    }
  });

  it("cada `pnpm <script>` del workflow existe en package.json", () => {
    const builtins = new Set(["install", "exec"]);
    const used = Object.values(jobsOf(readWorkflow()))
      .flatMap(commandsOf)
      .map((command) => /^pnpm\s+(\S+)/.exec(command)?.[1])
      .filter((script): script is string => script !== undefined && !builtins.has(script));

    expect(used.length).toBeGreaterThan(0);
    for (const script of used) {
      expect(scripts, `pnpm ${script} no está en package.json`).toHaveProperty([script]);
    }
  });
});

describe("CI workflow — timeouts (NFR-04)", () => {
  it(`cada job tiene timeout-minutes de ${MAX_TIMEOUT_MINUTES} o menos; uno sin timeout es rechazado`, () => {
    // Guard: the check does reject a job without a timeout, or with one over 10.
    const broken: Workflow = {
      jobs: {
        ok: { "timeout-minutes": 10 },
        missing: {},
        tooLong: { "timeout-minutes": 30 },
        expression: { "timeout-minutes": "${{ inputs.minutes }}" },
      },
    };
    expect(jobsWithoutValidTimeout(broken)).toEqual(["missing", "tooLong", "expression"]);

    const workflow = readWorkflow();

    expect(Object.keys(jobsOf(workflow)).length).toBeGreaterThan(0);
    expect(jobsWithoutValidTimeout(workflow)).toEqual([]);
  });
});

describe("CI workflow — actions fijadas por SHA (R-10)", () => {
  it("toda `uses:` está fijada por un SHA de 40 caracteres; una por tag, rama o SHA corto es rechazada", () => {
    // Guard: the check does reject a tag, a branch, a short SHA and a reusable workflow by tag.
    const broken: Workflow = {
      jobs: {
        build: {
          steps: [
            { uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1" },
            { uses: "actions/setup-node@v7" },
            { uses: "actions/cache@main" },
            { uses: "actions/upload-artifact@3d3c42e" },
            { uses: "./.github/actions/local" },
          ],
        },
        reusable: { uses: "owner/repo/.github/workflows/ci.yml@v1" },
      },
    };
    expect(unpinnedUses(broken).sort()).toEqual([
      "actions/cache@main",
      "actions/setup-node@v7",
      "actions/upload-artifact@3d3c42e",
      "owner/repo/.github/workflows/ci.yml@v1",
    ]);

    const workflow = readWorkflow();
    const allUses = Object.values(jobsOf(workflow)).flatMap((job) =>
      (job.steps ?? []).map((step) => step.uses).filter((uses) => uses !== undefined),
    );

    expect(allUses.length).toBeGreaterThan(0);
    expect(unpinnedUses(workflow)).toEqual([]);
  });

  it("cada `uses:` lleva la versión en un comentario", () => {
    const lines = readWorkflowText()
      .split("\n")
      .filter((line) => /^\s*(-\s+)?uses:/.test(line));

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, "falta el comentario con la versión").toMatch(/@[0-9a-f]{40}\s+#\s*v\d+/);
    }
  });
});
