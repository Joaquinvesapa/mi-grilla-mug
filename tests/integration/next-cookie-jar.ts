/**
 * An in-memory stand-in for `next/headers`, so Better Auth's `nextCookies()` plugin can write the
 * session cookie outside a real Next request. Test files mock the module with it:
 *
 *   vi.mock("next/headers", async () => (await import("./next-cookie-jar")).nextHeadersModule);
 *
 * and read the cookies back as a browser would send them with `requestHeaders()`.
 */

type CookieOptions = { maxAge?: number; expires?: Date };

const jar = new Map<string, string>();

function isRemoval(value: string, options: CookieOptions | undefined): boolean {
  if (value === "" || options?.maxAge === 0) {
    return true;
  }
  return options?.expires !== undefined && options.expires.getTime() <= Date.now();
}

const cookieStore = {
  get(name: string) {
    const value = jar.get(name);
    return value === undefined ? undefined : { name, value };
  },
  getAll() {
    return [...jar].map(([name, value]) => ({ name, value }));
  },
  has(name: string) {
    return jar.has(name);
  },
  set(name: string, value: string, options?: CookieOptions) {
    if (isRemoval(value, options)) {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  },
  delete(name: string) {
    jar.delete(name);
  },
};

export const nextHeadersModule = {
  cookies: async () => cookieStore,
  // A plain request: neither an RSC render nor a Server Action marker.
  headers: async () => new Headers(),
};

/** The `cookie` header a browser would send with the jar's current cookies. */
export function requestHeaders(): Headers {
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  return new Headers(cookie ? { cookie } : {});
}

export function readCookie(name: string): string | undefined {
  return jar.get(name);
}

export function clearCookies(): void {
  jar.clear();
}
