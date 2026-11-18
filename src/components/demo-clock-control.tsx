// No "use client" of its own: it only renders inside DemoStage, a client component, which is also
// what lets it take the `onChange` function.
import { useId, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_FESTIVAL_DATES, demoInstant, shiftDemoClock, type DemoDayId } from "@/lib/demo-clock";
import { FESTIVAL_TIME_ZONE, festivalDayAt, formatClock } from "@/lib/festival-time";

const DAY_LABELS: Record<DemoDayId, string> = {
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

const DAYS = (Object.keys(DEMO_FESTIVAL_DATES) as DemoDayId[]).map((id) => ({
  id,
  date: DEMO_FESTIVAL_DATES[id],
}));

/** The step of the time field and of the buttons, in minutes. */
const STEP_MINUTES = 15;

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  timeZone: FESTIVAL_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "viernes 13 de marzo": the calendar date of `instant` on the festival's clock. */
function formatDate(instant: Date): string {
  const parts = DATE_FORMAT.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} de ${part("month")}`;
}

export type DemoClockControlProps = {
  /** The simulated time in force. */
  value: Date;
  onChange: (instant: Date) => void;
};

/** The `/demo` clock: festival day, time and ±15 min (FEAT-005b, FR-01). */
export function DemoClockControl({ value, onChange }: DemoClockControlProps) {
  const timeId = useId();
  // What is typed in the time field while it does not hold a valid time; `null` shows the clock's.
  const [draft, setDraft] = useState<string | null>(null);

  const clock = formatClock(value);
  // The value always lies within the festival; Friday is only a fallback for the type.
  const dayId = festivalDayAt(value, DAYS) ?? "fri";
  const earlier = shiftDemoClock(value, -STEP_MINUTES);
  const later = shiftDemoClock(value, STEP_MINUTES);

  function changeDay(nextDay: string) {
    // Another day keeps the time on screen.
    const instant = demoInstant(nextDay, clock);
    if (instant) onChange(instant);
  }

  function changeTime(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.target.value;
    // Empty or not `HH:MM`: `demoInstant` returns null and the clock does not move.
    const instant = demoInstant(dayId, typed);
    if (instant) {
      setDraft(null);
      onChange(instant);
    } else {
      setDraft(typed);
    }
  }

  return (
    <section
      aria-labelledby={`${timeId}-title`}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${timeId}-title`} className="text-base font-semibold tracking-tight">
          Reloj de la demo
        </h2>
        <p className="text-sm text-muted-foreground">La app del iPhone vive a esta hora.</p>
      </div>

      <output aria-live="polite" className="flex flex-col gap-0.5">
        <span className="text-5xl font-semibold tracking-tight text-primary tabular-nums">
          {clock}
        </span>
        <span className="text-sm text-muted-foreground first-letter:uppercase">
          {formatDate(value)}
        </span>
      </output>

      {/* Only the day selector: the time controls below are not a day's content. */}
      <Tabs value={dayId} onValueChange={changeDay}>
        <TabsList className="w-full">
          {DAYS.map((day) => (
            <TabsTrigger key={day.id} value={day.id}>
              {DAY_LABELS[day.id]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={timeId}>Hora</Label>
          <Input
            id={timeId}
            type="time"
            step={STEP_MINUTES * 60}
            value={draft ?? clock}
            onChange={changeTime}
            onBlur={() => setDraft(null)}
            className="tabular-nums"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={earlier.getTime() === value.getTime()}
            onClick={() => onChange(earlier)}
          >
            −15 min
          </Button>
          <Button
            variant="outline"
            disabled={later.getTime() === value.getTime()}
            onClick={() => onChange(later)}
          >
            +15 min
          </Button>
        </div>
      </div>
    </section>
  );
}
