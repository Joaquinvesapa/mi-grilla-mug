"use client";

import { useEffect } from "react";

import { clearSnapshot } from "@/components/device-store";

/**
 * Forgets the device copy where nobody is signed in (`/login`, `/register`), so whoever signs in
 * next does not inherit the name and selection of the last one (R-03 of FEAT-003b). Pending
 * selections stay: they belong to their owners until they sign in again (FR-06).
 */
export function ForgetDeviceCopy() {
  useEffect(() => {
    // A failure means storage cannot be touched at all, so there is no copy to show either.
    clearSnapshot();
  }, []);
  return null;
}
