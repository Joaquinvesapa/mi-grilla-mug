// No "use client" of its own: no hooks, and it only renders inside ScheduleScreen, a client
// component, which is also what lets it take the `onChange` function.
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FestivalDay } from "@/lib/schedule-types";
import { cn } from "@/lib/utils";

export type DayPickerProps = {
  days: readonly FestivalDay[];
  /** The id of the day on screen. */
  value: string;
  onChange: (dayId: string) => void;
  /** The day's content, shown in the tab panel labelled by the active day. */
  children?: ReactNode;
  /** A control at the end of the days row, outside the tab panel (the wallpaper, FEAT-004). */
  action?: ReactNode;
};

/** Viernes, Sábado, Domingo, always at hand above the grid (FR-05). */
export function DayPicker({ days, value, onChange, children, action }: DayPickerProps) {
  const ordered = [...days].sort((a, b) => a.position - b.position);
  const hasAction = action !== undefined && action !== null;

  return (
    <Tabs value={value} onValueChange={onChange} className="min-h-0 flex-1 gap-0">
      {/* Without an action the row is exactly the list; with one, the days take what is left. */}
      <div className={cn("px-3 pb-2", hasAction && "flex items-center gap-2")}>
        <TabsList className={cn("w-full", hasAction && "min-w-0 flex-1")}>
          {ordered.map((day) => (
            <TabsTrigger key={day.id} value={day.id} className="min-h-11">
              {day.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {action}
      </div>
      <TabsContent value={value} className="flex min-h-0 flex-col">
        {children}
      </TabsContent>
    </Tabs>
  );
}
