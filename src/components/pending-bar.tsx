import { Button } from "@/components/ui/button";
import { pendingChangesLabel } from "@/lib/selection-messages";

export type PendingBarProps = {
  /** How many shows differ from what is saved. */
  count: number;
  saving: boolean;
  /** The message of the last failed save, already in Spanish; `null` when there is none. */
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
};

/**
 * The notice that stays at the bottom while the draft differs from what is saved (FR-11). Its
 * surface runs down under the home indicator and its content is padded out of it (mobile-native,
 * fix 7): `.app-fixed-screen` gives that inset back to the bars instead of leaving a strip of
 * background below the notice.
 */
export function PendingBar({ count, saving, error, onSave, onDiscard }: PendingBarProps) {
  return (
    <section
      aria-label="Cambios sin guardar"
      className="flex flex-col gap-2 border-t border-border bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <p className="tabular min-w-0 flex-1 text-sm font-medium">{pendingChangesLabel(count)}</p>
        <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>
          Descartar
        </Button>
        <Button type="button" onClick={onSave} disabled={saving} aria-busy={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </section>
  );
}
