import { CircleAlert } from "lucide-react";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEMO_FESTIVAL_DATES,
  DEMO_SLIDER_MAX,
  DEMO_SLIDER_STEP,
  DEMO_SLIDER_TICKS,
  clockToSliderMinutes,
  demoInstant,
  parseManualClock,
  shiftDemoClock,
  sliderMinutesToClock,
  stageTimelineRows,
  type DemoDayId,
} from "@/lib/demo-clock";
import { FESTIVAL_TIME_ZONE, festivalDayAt, formatClock } from "@/lib/festival-time";
import type { Schedule } from "@/lib/schedule-types";
import { dayStyle, stageStyle } from "@/lib/stage-colors";

const DAY_LABELS: Record<DemoDayId, string> = {
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

const DAYS = (Object.keys(DEMO_FESTIVAL_DATES) as DemoDayId[]).map((id) => ({
  id,
  date: DEMO_FESTIVAL_DATES[id],
}));

/** The step of the "±15 min" buttons, in minutes. */
const STEP_MINUTES = 15;

const MANUAL_ERROR =
  "Escribí una hora con formato HH:MM, entre 06:00 y 05:59 del día siguiente. Por ejemplo, 22:40.";

/** Half the thumb: the track and the ticks are inset by it so they line up with the thumb's travel. */
const THUMB_INSET = "mx-3.5";

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
  /** The festival grid: with it the mini timeline shows when each stage has shows. */
  schedule?: Schedule;
};

/** The `/demo` clock: festival day, slider, manual time and ±15 min (FEAT-005b, FR-01; FEAT-008). */
export function DemoClockControl({ value, onChange, schedule }: DemoClockControlProps) {
  const timeId = useId();
  // What is typed in the manual field, and whether the last try was not a time.
  const [manual, setManual] = useState("");
  const [manualInvalid, setManualInvalid] = useState(false);

  const clock = formatClock(value);
  // The value always lies within the festival; Friday is only a fallback for the type.
  const dayId = festivalDayAt(value, DAYS) ?? "fri";
  const dayName = DAY_LABELS[dayId as DemoDayId] ?? DAY_LABELS.fri;
  const earlier = shiftDemoClock(value, -STEP_MINUTES);
  const later = shiftDemoClock(value, STEP_MINUTES);
  const sliderMinutes = clockToSliderMinutes(clock);
  const ratio = sliderMinutes / 1_440;
  const isNight = sliderMinutes >= 1_080;
  const rows = schedule ? stageTimelineRows(schedule, dayId) : null;

  function changeDay(nextDay: string) {
    // Another day keeps the time on screen.
    const instant = demoInstant(nextDay, clock);
    if (instant) onChange(instant);
  }

  function changeSlider(event: ChangeEvent<HTMLInputElement>) {
    const minutes = Number(event.target.value);
    if (!Number.isFinite(minutes)) return;
    const instant = demoInstant(dayId, sliderMinutesToClock(minutes));
    if (instant) {
      onChange(instant);
    }
  }

  function changeManual(event: ChangeEvent<HTMLInputElement>) {
    setManual(event.target.value);
    setManualInvalid(false);
  }

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = parseManualClock(manual);
    const instant = typed ? demoInstant(dayId, typed) : null;
    if (!instant) {
      setManualInvalid(true);
      return;
    }
    setManual("");
    setManualInvalid(false);
    onChange(instant);
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

      {/* Only the day selector: the time controls below are not a day's content. */}
      <Tabs value={dayId} onValueChange={changeDay}>
        <TabsList className="w-full">
          {DAYS.map((day) => (
            <TabsTrigger
              key={day.id}
              value={day.id}
              style={dayStyle(day.id)}
              className="group/day font-semibold data-[state=active]:border-transparent data-[state=active]:bg-(--day) data-[state=active]:text-(--on-day)"
            >
              {/* The inactive tabs carry their day's color as a dot. */}
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-(--day) group-data-[state=active]/day:hidden"
              />
              {DAY_LABELS[day.id]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <output aria-live="polite" className="flex items-baseline gap-3">
        <span className="text-5xl font-semibold tracking-tight text-primary tabular-nums">
          {clock}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{dayName}</span>
          <span className="text-xs text-muted-foreground first-letter:uppercase">
            {formatDate(value)}
          </span>
          <span className="text-xs text-muted-foreground">
            {isNight
              ? `Madrugada: sigue siendo la noche del ${dayName.toLowerCase()}`
              : "Día del festival, 06:00 a 06:00"}
          </span>
        </span>
      </output>

      <div className="flex flex-col">
        {rows ? (
          <div className={`relative ${THUMB_INSET} flex flex-col gap-0.5`} aria-hidden="true">
            {rows.map((row) => (
              <div
                key={row.stageId}
                data-timeline-stage={row.stageId}
                style={stageStyle(row.stageId)}
                className="relative h-1 overflow-hidden rounded-full bg-border/45"
              >
                {row.spans.map((span) => (
                  <i
                    key={span.left}
                    data-span=""
                    className="absolute inset-y-0 rounded-[1px] bg-(--stage)"
                    style={{ left: `${span.left * 100}%`, width: `${span.width * 100}%` }}
                  />
                ))}
                {/* The part of the day already gone. */}
                <div
                  className="absolute inset-y-0 left-0 bg-card/55"
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
            ))}
            <div
              data-timeline-cursor=""
              className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-rp-love motion-safe:transition-[left] motion-safe:duration-200"
              style={{ left: `${ratio * 100}%` }}
            />
          </div>
        ) : null}
        <div className="relative mt-1.5 h-11">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-5 h-1 rounded-full bg-accent ${THUMB_INSET}`}
          />
          <input
            type="range"
            aria-label="Hora simulada"
            aria-valuetext={`${dayName} ${clock}`}
            min={0}
            max={DEMO_SLIDER_MAX}
            step={DEMO_SLIDER_STEP}
            value={sliderMinutes}
            onChange={changeSlider}
            className="relative m-0 h-11 w-full cursor-pointer [touch-action:pan-y] appearance-none bg-transparent outline-none [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-rp-love [&::-moz-range-thumb]:bg-foreground focus-visible:[&::-moz-range-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-ring/60 [&::-moz-range-track]:h-11 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-11 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-2 [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-rp-love [&::-webkit-slider-thumb]:bg-foreground focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ring/60"
          />
        </div>
        <div aria-hidden="true" className={`relative ${THUMB_INSET} h-7`}>
          {DEMO_SLIDER_TICKS.map((tick, index) => (
            <span
              key={index}
              className="absolute top-0 -translate-x-1/2 text-center text-[11px] leading-none text-muted-foreground tabular-nums before:mx-auto before:mb-1 before:block before:h-[5px] before:w-px before:bg-rp-highlight-high"
              style={{ left: `${tick.ratio * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={submitManual} noValidate className="flex flex-col gap-2">
        <Label htmlFor={`${timeId}-manual`}>Poné la hora a mano</Label>
        <div className="flex gap-2">
          <Input
            id={`${timeId}-manual`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            placeholder="22:40"
            value={manual}
            onChange={changeManual}
            aria-invalid={manualInvalid}
            aria-describedby={manualInvalid ? `${timeId}-manual-error` : undefined}
            className="flex-1 tabular-nums"
          />
          <Button type="submit" className="min-w-16">
            Ir
          </Button>
        </div>
        {manualInvalid ? (
          <p
            id={`${timeId}-manual-error`}
            role="alert"
            className="flex items-start gap-1.5 text-[13px] leading-snug"
          >
            <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
            <span>{MANUAL_ERROR}</span>
          </p>
        ) : null}
      </form>

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
    </section>
  );
}
