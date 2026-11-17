import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";

/** A show as `data/schedule.json` versions it: poster times, "HH:MM", in Buenos Aires. */
export type ScheduleShow = {
  id: string;
  dayId: string;
  stageId: string;
  artist: string;
  subtitle?: string;
  start: string;
  end: string;
};

export type ScheduleData = {
  days: { id: string; name: string; date: string; position: number }[];
  stages: { id: string; name: string; position: number }[];
  shows: ScheduleShow[];
};

/** The versioned grid: what the screen has to show, read straight from the source of the seed. */
export const SCHEDULE: ScheduleData = JSON.parse(
  readFileSync(join(process.cwd(), "data", "schedule.json"), "utf8"),
) as ScheduleData;

/** The days in the order of the day picker. */
export const DAYS = [...SCHEDULE.days].sort((a, b) => a.position - b.position);

/** The stages in the order of the columns. */
export const STAGES = [...SCHEDULE.stages].sort((a, b) => a.position - b.position);

/** A show by its stable id (never by artist: Arjaus Crew plays the 3 days). */
export function showById(id: string): ScheduleShow {
  const show = SCHEDULE.shows.find((item) => item.id === id);
  if (!show) throw new Error(`No hay un show con id ${id} en data/schedule.json`);
  return show;
}

export function dayName(dayId: string): string {
  const day = SCHEDULE.days.find((item) => item.id === dayId);
  if (!day) throw new Error(`No hay un día con id ${dayId} en data/schedule.json`);
  return day.name;
}

export function showsOfDay(dayId: string): ScheduleShow[] {
  return SCHEDULE.shows.filter((show) => show.dayId === dayId);
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  // The festival day runs 06:00 to 06:00: an hour before 06:00 belongs to the next calendar day.
  const absolute = (hours ?? 0) * 60 + (minutes ?? 0);
  return absolute < 6 * 60 ? absolute + 24 * 60 : absolute;
}

/** Start and end in minutes from 00:00 of the festival day (past midnight goes over 1440). */
export function interval(show: ScheduleShow): { start: number; end: number } {
  return { start: minutesOf(show.start), end: minutesOf(show.end) };
}

export function durationMinutes(show: ScheduleShow): number {
  const { start, end } = interval(show);
  return end - start;
}

/** The block's accessible name: "Artista [subtítulo] HH:MM – HH:MM" (the marks only describe it). */
export function expectedName(show: ScheduleShow): string {
  return [show.artist, show.subtitle, `${show.start} – ${show.end}`].filter(Boolean).join(" ");
}

type Target = Page | FrameLocator;

/** The scroll container of the day on screen: the region "Grilla del {día}". */
export function gridRegion(target: Target, dayId?: string): Locator {
  return target.getByRole("region", {
    name: dayId ? `Grilla del ${dayName(dayId)}` : /^Grilla del /,
  });
}

/** A show's block, located by its stable id (within a page, a frame or the grid region). */
export function showBlock(target: Target | Locator, showId: string): Locator {
  return target.locator(`[data-show-id="${showId}"]`);
}

/** The pending notice at the bottom of the screen. */
export function pendingBar(target: Target): Locator {
  return target.getByRole("region", { name: "Cambios sin guardar" });
}

/** "Guardar" inside the notice: elsewhere other buttons could answer to the same word. */
export function saveButton(target: Target): Locator {
  return pendingBar(target).getByRole("button", { name: "Guardar", exact: true });
}

export function discardButton(target: Target): Locator {
  return pendingBar(target).getByRole("button", { name: "Descartar", exact: true });
}

/** Picks a day in the day picker and waits for its grid. */
export async function chooseDay(target: Target, dayId: string): Promise<void> {
  await target.getByRole("tab", { name: dayName(dayId), exact: true }).click();
  await expect(gridRegion(target, dayId)).toBeVisible();
}

/**
 * Opens the menu sheet and returns it. The sheet is a Vaul drawer: it renders nothing until it is
 * open, so whatever lives in it (the greeting, the install guide, "Cerrar sesión") has to be looked
 * for after this.
 */
export async function openMenu(target: Target): Promise<Locator> {
  await target.getByRole("button", { name: "Menú", exact: true }).click();
  const sheet = target.getByRole("dialog");
  await expect(sheet).toBeVisible();
  // The sheet slides in: wait until it is in place, or a click can land where it used to be. Not a
  // ratio of 1: at the end of Vaul's curve the last fraction of a pixel takes a while (0.99999).
  await expect(sheet.getByRole("button", { name: "Cerrar sesión" })).toBeInViewport({
    ratio: 0.99,
  });
  return sheet;
}

/** Opens the menu and taps "Cerrar sesión" (with pending changes it asks first, FR-12). */
export async function tapLogout(target: Target): Promise<void> {
  const sheet = await openMenu(target);
  await sheet.getByRole("button", { name: "Cerrar sesión" }).click();
}

/** Saves what is marked and waits until the notice goes away (the save landed). */
export async function saveSelection(target: Target): Promise<void> {
  await saveButton(target).click();
  await expect(pendingBar(target)).toHaveCount(0);
}
