import { vi } from "vitest";

// jsdom has no `window.matchMedia`, and Vaul (the menu's sheet) asks it whether the app runs
// standalone when the sheet opens. Nothing here matches: a browser tab, not the installed app.
// Stubbed with vi.stubGlobal, so `vi.unstubAllGlobals()` (in the file's afterAll) takes it back.
export function stubMatchMedia(): void {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

/**
 * Ends Vaul's close animation by hand, on the sheet and on its overlay.
 *
 * Vaul keeps a closed sheet mounted (and the rest of the page `aria-hidden`) until the
 * `animationend` of its slide-out arrives, and jsdom never plays CSS animations, so that event
 * never comes on its own: without this, a test that closes the sheet still finds the dialog. jsdom
 * has no `AnimationEvent` either, so `animationName` is set on a plain `Event`. Call it inside
 * `act`, after the close (Escape, swipe or `onOpenChange(false)`).
 */
export function endVaulCloseAnimation(dialog: Element): void {
  dispatchAnimationEnd(dialog, "slideToBottom");
  for (const overlay of document.querySelectorAll("[data-vaul-overlay]")) {
    dispatchAnimationEnd(overlay, "fadeOut");
  }
}

function dispatchAnimationEnd(target: Element, animationName: string): void {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: animationName });
  target.dispatchEvent(event);
}
