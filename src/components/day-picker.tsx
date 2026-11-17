// No "use client" of its own: no hooks, and it only renders inside ScheduleScreen, a client
// component, which is also what lets it take the `onChange` function.
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FestivalDay } from "@/lib/schedule-types";

export type DayPickerProps = {
  days: readonly FestivalDay[];
  /** The id of the day on screen. */
  value: string;
  onChange: (dayId: string) => void;
  /** The day's content, shown in the tab panel labelled by the active day. */
  children?: ReactNode;
};

/** Viernes, Sábado, Domingo, always at hand above the grid (FR-05). */
export function DayPicker({ days, value, onChange, children }: DayPickerProps) {
  const ordered = [...days].sort((a, b) => a.position - b.position);

  return (
    <Tabs value={value} onValueChange={onChange} className="min-h-0 flex-1 gap-0">
      <div className="px-3 pb-2">
        <TabsList className="w-full">
          {ordered.map((day) => (
            <TabsTrigger key={day.id} value={day.id} className="min-h-11">
              {day.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={value} className="flex min-h-0 flex-col">
        {children}
      </TabsContent>
    </Tabs>
  );
}
