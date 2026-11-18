import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// A pending selection or a device copy written by one test must not show up in the next one.
// Files that opt into `@vitest-environment node` have no `localStorage` at all.
afterEach(() => {
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});
