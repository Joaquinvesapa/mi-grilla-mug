import { getHealthChecker } from "@/server/health";

// Every request reports the live state; never prerendered at build time.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(): Promise<Response> {
  const { status, database } = await getHealthChecker().check();
  // Built field by field: anything else the server result carries never reaches the client (R-01).
  return Response.json(
    { status, database },
    { status: status === "ok" ? 200 : 503, headers: NO_STORE },
  );
}

function methodNotAllowed(): Response {
  return Response.json(
    { error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { ...NO_STORE, Allow: "GET" } },
  );
}

// The endpoint only answers GET (FR-04); every other method, HEAD and OPTIONS included, gets 405.
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
