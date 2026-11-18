import { describe, expect, it } from "vitest";

import { posterTimeToInstant } from "@/lib/festival-time";
import {
  CLOSE_LABEL,
  DONE_FOR_TODAY,
  FESTIVAL_OVER,
  LIVE_LABEL,
  minutesUntilLabel,
  NEXT_PREFIX,
  nextShowLabel,
  NO_LIVE_SHOWS,
  NOTHING_NOW,
  NOW_LABEL,
  CLASH_LABEL,
  minutesLeftLabel,
  PROGRESS_LABEL,
  SELECTED_LABEL,
} from "@/lib/live-messages";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";

const SATURDAY: FestivalDay = { id: "sat", name: "Sábado", date: "2026-03-14", position: 2 };
const SAMSUNG: Stage = { id: "samsung", name: "Samsung", position: 2 };
const TOBIKA: Show = {
  id: "sat-samsung-1345",
  dayId: "sat",
  stageId: "samsung",
  artist: "Tobika",
  subtitle: null,
  startsAt: posterTimeToInstant("2026-03-14", "13:45").toISOString(),
  endsAt: posterTimeToInstant("2026-03-14", "14:30").toISOString(),
};

describe("live messages", () => {
  it("live-messages: textos de idle hoy, otro día y minutos", () => {
    expect(nextShowLabel({ show: TOBIKA, stage: SAMSUNG, day: SATURDAY, sameDay: true })).toBe(
      "Sigue hoy a las 13:45 — Tobika en Samsung",
    );
    expect(nextShowLabel({ show: TOBIKA, stage: SAMSUNG, day: SATURDAY, sameDay: false })).toBe(
      "Sigue el sábado a las 13:45 — Tobika en Samsung",
    );
    expect(minutesUntilLabel(1)).toBe("en 1 min");
    expect(minutesLeftLabel(1)).toBe("quedan 1 min");
    expect(minutesLeftLabel(60)).toBe("quedan 60 min");
    expect(minutesUntilLabel(60)).toBe("en 60 min");
  });

  it("has the fixed texts of the panel", () => {
    expect(NOTHING_NOW).toBe("Nada ahora");
    expect(DONE_FOR_TODAY).toBe("Terminó por hoy");
    expect(NO_LIVE_SHOWS).toBe("No hay shows en vivo");
    expect(FESTIVAL_OVER).toBe("El festival terminó");
    expect(LIVE_LABEL).toBe("En vivo");
    expect(CLOSE_LABEL).toBe("Cerrar");
    expect(SELECTED_LABEL).toBe("Elegido");
    expect(NOW_LABEL).toBe("Ahora");
    expect(CLASH_LABEL).toBe("Choque");
    expect(PROGRESS_LABEL).toBe("Avance del show");
    expect(NEXT_PREFIX).toBe("Sigue:");
  });
});
