import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// shadcn/ui Input (new-york), adapted to Mi Grilla:
// - `cn` from `@/lib/utils`, like the other components (the CLI now emits the `cn` package);
// - single dark theme, so the `dark:` variants are folded into the base classes;
// - 44 px tall (`h-11`) and a fixed 16 px font (`text-base`, no `md:text-sm`): under 16 px iOS
//   Safari zooms the page into the field and never zooms back (NFR-03, mobile-native fix 4).
function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-input/30 px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
