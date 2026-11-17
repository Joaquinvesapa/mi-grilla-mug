import "server-only";

// The check itself is pure and lives in src/lib, where the seed can reach it without Next. Server
// modules keep importing it from here.
export {
  assertSafeDatabaseUrl,
  UnsafeDatabaseUrlError,
  type UnsafeDatabaseUrlCode,
} from "@/lib/database-url";
