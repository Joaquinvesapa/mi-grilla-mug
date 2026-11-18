import { cn } from "@/lib/utils";

/**
 * The «playing now» dot (design/color-en-vivo): a solid love dot with a halo that pulses only when
 * motion is allowed. Decorative: whoever renders it also says «Ahora» / «En vivo» in text, so the
 * state never depends on the color or the animation alone.
 */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-live-dot=""
      className={cn("relative inline-block size-2 shrink-0 rounded-full bg-rp-love", className)}
    >
      <span className="absolute inset-0 rounded-full bg-rp-love motion-safe:animate-live-ping" />
    </span>
  );
}
