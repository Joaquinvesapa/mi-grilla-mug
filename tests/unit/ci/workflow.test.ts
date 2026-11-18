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
const PLAYWRIGHT_CONFIG_PATH = resolve(process.cwd(), "playwright.config.ts");
/** The e2e step: the projects come from the step's env, never interpolated into `run:` (FIX-001). */
const E2E_COMMAND = "pnpm test:e2e $E2E_PROJECTS";
/** A PR runs only the iPhone project; a push to main runs the four (FIX-001, FR-01/FR-02). */
const E2E_PROJECTS_EXPR =
  "${{ github.event_name == 'pull_request' && '--project=iphone-webkit' || '' }}";
const E2E_DOCKER_SCRIPT_PATH = resolve(process.cwd(), "scripts/test-e2e-docker.sh");
/** Creates, migrates and seeds the test database (FIX-004). */
const TEST_DATABASE_PREPARE = "pnpm db:test:prepare";

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
  container?: string | ({ image?: string } & Record<string, unknown>);
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
 * Jobs (keys of `suites`) where `pnpm db:test:prepare` is missing or not before the job's suite
 * command, or that still run `pnpm db:migrate` or `pnpm db:seed`: the suites read the schema and the
 * grid from the test database, which that one command migrates and seeds (FIX-004).
 */
function jobsPreparingOutOfOrder(workflow: Workflow, suites: Record<string, string>): string[] {
  const jobs = jobsOf(workflow);
  return Object.entries(suites)
    .filter(([name, suite]) => {
      const commands = commandsOf(jobs[name] ?? {});
      const prepare = commands.indexOf(TEST_DATABASE_PREPARE);
      const run = commands.indexOf(suite);
      const leftover = commands.some((c) => c === "pnpm db:migrate" || c === "pnpm db:seed");
      return prepare < 0 || run < 0 || prepare > run || leftover;
    })
    .map(([name]) => name);
}

/** Jobs (from `names`) whose env lacks `TEST_DATABASE_URL` or still sets `DATABASE_URL`. */
function jobsWithoutTestDatabase(workflow: Workflow, names: string[]): string[] {
  const jobs = jobsOf(workflow);
  return names.filter((name) => {
    const env = jobs[name]?.env ?? {};
    const url = env.TEST_DATABASE_URL;
    return typeof url !== "string" || url === "" || "DATABASE_URL" in env;
  });
}

/** The `name:` of every Playwright project in playwright.config.ts. */
function playwrightProjectNames(): string[] {
  const config = readFileSync(PLAYWRIGHT_CONFIG_PATH, "utf8");
  return [...config.matchAll(/^\s*name:\s*"([^"]+)"/gm)].map((match) => match[1] ?? "");
}

/**
 * Why the e2e job does not pick its Playwright projects by event, or null when it does: the step
 * that runs E2E_COMMAND carries `env.E2E_PROJECTS === E2E_PROJECTS_EXPR`, and every
 * `--project=<name>` in that value is a project of playwright.config.ts.
 */
function e2eProjectsProblem(workflow: Workflow, projectNames: string[]): string | null {
  const step = (jobsOf(workflow).e2e?.steps ?? []).find((s) => s.run?.trim() === E2E_COMMAND);
  if (!step) return `falta el step \`${E2E_COMMAND}\` en el job e2e`;
  const env = (step.env ?? {}) as Record<string, unknown>;
  const value = env.E2E_PROJECTS;
  if (value !== E2E_PROJECTS_EXPR) {
    return `E2E_PROJECTS faltante o con otra expresión: ${JSON.stringify(value)}`;
  }
  const invalid = [...String(value).matchAll(/--project=([\w-]+)/g)]
    .map((match) => match[1] ?? "")
    .filter((name) => !projectNames.includes(name));
  return invalid.length > 0 ? `proyecto inválido en E2E_PROJECTS: ${invalid.join(", ")}` : null;
}

/** The exact version of @playwright/test in package.json (versions are pinned, no `^`). */
function playwrightVersion(): string {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  return pkg.devDependencies?.["@playwright/test"] ?? "";
}

/** The official Playwright image that ships the browsers of that version (FIX-002). */
function playwrightImage(version: string): string {
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}

/**
 * Why the e2e job does not run inside the Playwright image, or null when it does (FIX-002): the
 * job's `container` is `playwrightImage(version)`, no step installs browsers or caches
 * `ms-playwright` (the system libraries came from apt on every run and hung it), and the job
 * reaches its `postgres` service by that host name, as a container must.
 */
function e2eContainerProblem(workflow: Workflow, version: string): string | null {
  const e2e = jobsOf(workflow).e2e;
  if (!e2e) return "falta el job e2e";
  const container = e2e.container;
  const image = typeof container === "string" ? container : container?.image;
  const expected = playwrightImage(version);
  if (image !== expected) {
    return `imagen del container inválida: ${JSON.stringify(image)}, se esperaba ${expected}`;
  }
  const steps = e2e.steps ?? [];
  const install = steps.find((step) => /playwright install/.test(step.run ?? ""));
  if (install) return `step rechazado, instala navegadores: ${install.run}`;
  const cache = steps.find((step) =>
    JSON.stringify(step.with?.path ?? "").includes("ms-playwright"),
  );
  if (cache) return `step rechazado, cachea ms-playwright: ${cache.uses}`;
  if (!e2e.services?.postgres) return "service postgres faltante en el job e2e";
  const rawUrl = e2e.env?.TEST_DATABASE_URL;
  const url = typeof rawUrl === "string" ? rawUrl : "";
  const host = /@([^:/]+)[:/]/.exec(url)?.[1];
  return host === "postgres" ? null : `host de TEST_DATABASE_URL inválido: ${JSON.stringify(host)}`;
}

/** The variables scripts/test-e2e-docker.sh forwards by name (`-e NAME`) to the container. */
function e2eDockerForwardedVariables(script: string): string[] {
  return [...script.matchAll(/^\s*-e\s+([A-Z_][A-Z0-9_]*)\s*\\?$/gm)].map(
    (match) => match[1] ?? "",
  );
}

/** The `IMAGE=` that scripts/test-e2e-docker.sh runs the suite in. */
function e2eDockerScriptImage(script: string): string | undefined {
  return /^IMAGE="([^"]+)"$/m.exec(script)?.[1];
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

  it("integration prepara la base de tests y corre la suite de integración contra un postgres:17.N", () => {
    const integration = jobsOf(readWorkflow()).integration;
    expect(integration, "falta el job integration").toBeDefined();

    expect(integration!.services?.postgres?.image).toMatch(PINNED_POSTGRES);
    expect(commandsOf(integration!)).toEqual(
      expect.arrayContaining([
        "pnpm install --frozen-lockfile",
        TEST_DATABASE_PREPARE,
        "pnpm test:integration",
      ]),
    );
    const env = integration!.env ?? {};
    expect(typeof env.TEST_DATABASE_URL, "integration: falta TEST_DATABASE_URL").toBe("string");
    expect(Object.keys(env), "integration no debería definir DATABASE_URL").not.toContain(
      "DATABASE_URL",
    );
  });

  it("test-workflow-e2e-container: e2e corre en la imagen de Playwright de su versión, sin instalar navegadores, contra el host postgres, y sube el reporte si falla; una imagen inválida, sin container, con playwright install, con la cache de ms-playwright, con TEST_DATABASE_URL a 127.0.0.1 o con el service faltante es rechazado", () => {
    const version = playwrightVersion();
    expect(version, "falta @playwright/test en package.json").toMatch(/^\d+\.\d+\.\d+$/);
    const workflow = readWorkflow();
    expect(e2eContainerProblem(workflow, version)).toBeNull();

    const e2e = jobsOf(workflow).e2e!;
    expect(e2e.services?.postgres?.image).toMatch(PINNED_POSTGRES);
    expect(commandsOf(e2e)).toEqual(
      expect.arrayContaining(["pnpm install --frozen-lockfile", E2E_COMMAND]),
    );
    const report = (e2e.steps ?? []).find((step) =>
      step.uses?.startsWith("actions/upload-artifact@"),
    );
    expect(report, "falta subir playwright-report").toBeDefined();
    expect(report!.if).toBe("failure()");
    expect(report!.with?.path).toBe("playwright-report");

    // Sad paths over fixtures built from a valid job.
    const ok: Job = {
      container: { image: playwrightImage(version) },
      services: { postgres: { image: "postgres:17.12" } },
      env: { TEST_DATABASE_URL: "postgresql://u:p@postgres:5432/db" },
      steps: [{ run: E2E_COMMAND }],
    };
    const withJob = (job: Job): Workflow => ({ jobs: { e2e: job } });
    expect(e2eContainerProblem(withJob(ok), version)).toBeNull();
    expect(
      e2eContainerProblem(withJob({ ...ok, container: playwrightImage(version) }), version),
    ).toBeNull();
    const rejected: Record<string, Job> = {
      "versión inválida": { ...ok, container: { image: playwrightImage("1.64.0") } },
      "container faltante": { ...ok, container: undefined },
      "playwright install": {
        ...ok,
        steps: [{ run: "pnpm exec playwright install --with-deps webkit chromium" }, ...ok.steps!],
      },
      "cache de ms-playwright": {
        ...ok,
        steps: [{ uses: "actions/cache@x", with: { path: "~/.cache/ms-playwright" } }],
      },
      "host 127.0.0.1": {
        ...ok,
        env: { TEST_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/db" },
      },
      "solo DATABASE_URL": {
        ...ok,
        env: { DATABASE_URL: "postgresql://u:p@postgres:5432/db" },
      },
      "service postgres faltante": { ...ok, services: {} },
    };
    for (const [why, job] of Object.entries(rejected)) {
      expect(e2eContainerProblem(withJob(job), version), why).not.toBeNull();
    }
    expect(e2eContainerProblem({ jobs: {} }, version)).toBe("falta el job e2e");
  });

  it("test-e2e-docker-image: scripts/test-e2e-docker.sh corre en la misma imagen de Playwright que la CI; una imagen de otra versión es rechazada (versión inválida)", () => {
    const expected = playwrightImage(playwrightVersion());
    const script = readFileSync(E2E_DOCKER_SCRIPT_PATH, "utf8");
    expect(e2eDockerScriptImage(script)).toBe(expected);
    // Sad path: a script left on another version does not match.
    const stale = script.replace(/^IMAGE="[^"]+"$/m, `IMAGE="${playwrightImage("1.64.0")}"`);
    expect(e2eDockerScriptImage(stale)).not.toBe(expected);
  });

  it("test-workflow-auth-env: integration y e2e tienen BETTER_AUTH_SECRET y BETTER_AUTH_URL, quality ninguna, y e2e prepara la base de tests antes de correr Playwright", () => {
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
    const prepare = e2eCommands.indexOf(TEST_DATABASE_PREPARE);
    expect(prepare, `e2e no corre ${TEST_DATABASE_PREPARE}`).toBeGreaterThanOrEqual(0);
    expect(prepare, "e2e prepara la base después de pnpm test:e2e").toBeLessThan(
      e2eCommands.indexOf(E2E_COMMAND),
    );
  });

  it("test-workflow-test-database: integration y e2e definen TEST_DATABASE_URL y no DATABASE_URL, corren pnpm db:test:prepare antes de su suite y ya no corren db:migrate ni db:seed; un job sin la variable o con el paso faltante es rechazado", () => {
    const SUITES: Record<string, string> = {
      integration: "pnpm test:integration",
      e2e: E2E_COMMAND,
    };
    const URL_ENV = { TEST_DATABASE_URL: "postgresql://u:p@postgres:5432/db" };

    // Guard: a job without the step, with it after the suite, or still migrating or seeding on its
    // own, is rejected; so is one without the variable, or with DATABASE_URL beside it.
    const broken: Workflow = {
      jobs: {
        missing: { env: URL_ENV, steps: [{ run: "pnpm test:integration" }] },
        afterSuite: {
          env: URL_ENV,
          steps: [{ run: "pnpm test:e2e" }, { run: TEST_DATABASE_PREPARE }],
        },
        leftover: {
          env: URL_ENV,
          steps: [
            { run: TEST_DATABASE_PREPARE },
            { run: "pnpm db:migrate" },
            { run: "pnpm test:e2e" },
          ],
        },
        noVariable: { steps: [{ run: TEST_DATABASE_PREPARE }, { run: "pnpm test:e2e" }] },
        alsoDevelopment: {
          env: { ...URL_ENV, DATABASE_URL: "postgresql://u:p@postgres:5432/db" },
          steps: [{ run: TEST_DATABASE_PREPARE }, { run: "pnpm test:e2e" }],
        },
        ok: { env: URL_ENV, steps: [{ run: TEST_DATABASE_PREPARE }, { run: "pnpm test:e2e" }] },
      },
    };
    const brokenSuites: Record<string, string> = {
      missing: "pnpm test:integration",
      afterSuite: "pnpm test:e2e",
      leftover: "pnpm test:e2e",
      noVariable: "pnpm test:e2e",
      alsoDevelopment: "pnpm test:e2e",
      ok: "pnpm test:e2e",
    };
    expect(jobsPreparingOutOfOrder(broken, brokenSuites)).toEqual([
      "missing",
      "afterSuite",
      "leftover",
    ]);
    expect(jobsWithoutTestDatabase(broken, Object.keys(brokenSuites))).toEqual([
      "noVariable",
      "alsoDevelopment",
    ]);

    const workflow = readWorkflow();
    expect(jobsPreparingOutOfOrder(workflow, SUITES)).toEqual([]);
    expect(jobsWithoutTestDatabase(workflow, Object.keys(SUITES))).toEqual([]);
    // The integration job reaches its service through the runner's loopback.
    expect(String(jobsOf(workflow).integration?.env?.TEST_DATABASE_URL)).toMatch(/@127\.0\.0\.1:/);
  });

  it("test-e2e-docker-forwards-test-database: scripts/test-e2e-docker.sh reenvía -e TEST_DATABASE_URL y no -e DATABASE_URL, y package.json define db:test:prepare", () => {
    const script = readFileSync(E2E_DOCKER_SCRIPT_PATH, "utf8");
    const forwarded = e2eDockerForwardedVariables(script);
    expect(forwarded).toContain("TEST_DATABASE_URL");
    expect(forwarded).not.toContain("DATABASE_URL");
    expect(forwarded).toContain("BETTER_AUTH_SECRET");
    // Guard: a script still forwarding DATABASE_URL is caught.
    expect(e2eDockerForwardedVariables("  -e CI \\\n  -e DATABASE_URL \\\n")).toEqual([
      "CI",
      "DATABASE_URL",
    ]);

    expect(scripts["db:test:prepare"]).toBe("bash scripts/db-test-prepare.sh");
    expect(existsSync(resolve(process.cwd(), "scripts/db-test-prepare.sh"))).toBe(true);
    // The development database keeps its own commands (FR-05).
    expect(scripts["db:migrate"]).toBe("prisma migrate deploy");
    expect(scripts["db:seed"]).toBe("node prisma/seed.ts");
  });

  it("test-workflow-e2e-projects-by-event: en un PR el job e2e corre solo iphone-webkit y en main los 4 proyectos; E2E_PROJECTS faltante, con otra expresión o con un proyecto inválido es rechazado", () => {
    const projects = playwrightProjectNames();
    expect(projects).toEqual(["iphone-webkit", "mobile-chromium", "mobile-360", "desktop"]);

    const withStep = (step: Step): Workflow => ({ jobs: { e2e: { steps: [step] } } });
    const otherProject = E2E_PROJECTS_EXPR.replace("iphone-webkit", "iphone-safari");
    // Guard: missing, different and invalid-project variants are rejected, the right one is not.
    expect(e2eProjectsProblem(withStep({ run: "pnpm test:e2e" }), projects)).toMatch(
      /falta el step/,
    );
    expect(e2eProjectsProblem(withStep({ run: E2E_COMMAND }), projects)).toMatch(/faltante/);
    expect(
      e2eProjectsProblem(
        withStep({ run: E2E_COMMAND, env: { E2E_PROJECTS: "--project=iphone-webkit" } }),
        projects,
      ),
    ).toMatch(/otra expresión/);
    expect(
      e2eProjectsProblem(withStep({ run: E2E_COMMAND, env: { E2E_PROJECTS: otherProject } }), [
        ...projects,
      ]),
    ).toMatch(/otra expresión/);
    expect(
      e2eProjectsProblem(withStep({ run: E2E_COMMAND, env: { E2E_PROJECTS: E2E_PROJECTS_EXPR } }), [
        "mobile-chromium",
      ]),
    ).toMatch(/proyecto inválido en E2E_PROJECTS: iphone-webkit/);
    expect(
      e2eProjectsProblem(
        withStep({ run: E2E_COMMAND, env: { E2E_PROJECTS: E2E_PROJECTS_EXPR } }),
        projects,
      ),
    ).toBeNull();

    expect(e2eProjectsProblem(readWorkflow(), projects)).toBeNull();
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
