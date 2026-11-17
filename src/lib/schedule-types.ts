// The festival grid as the app reads it. Instants are ISO strings (not `Date`) so a schedule can be
// passed as-is from a Server Component to a client one.

export type FestivalDay = {
  /** `fri`, `sat` or `sun`. */
  id: string;
  /** "Viernes", "Sábado" o "Domingo". */
  name: string;
  /** Calendar date the festival day starts on, `YYYY-MM-DD`. It runs until 06:00 of the next. */
  date: string;
  /** 1-based order of the day. */
  position: number;
};

export type Stage = {
  id: string;
  name: string;
  /** 1-based column of the stage in the grid. */
  position: number;
};

export type Show = {
  /** Stable id assigned once in `data/schedule.json`; a show is never identified by its artist. */
  id: string;
  dayId: string;
  stageId: string;
  artist: string;
  subtitle: string | null;
  /** ISO instant. */
  startsAt: string;
  /** ISO instant; after `startsAt`, possibly past midnight. */
  endsAt: string;
};

export type Schedule = {
  days: FestivalDay[];
  stages: Stage[];
  shows: Show[];
};
