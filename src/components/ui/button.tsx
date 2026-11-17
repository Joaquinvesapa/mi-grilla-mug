"use client";

import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { usePressed } from "@/components/pressable";
import { cn } from "@/lib/utils";

// shadcn/ui Button (new-york), adapted to Mi Grilla:
// - single dark theme, so the `dark:` variants are folded into the base classes;
// - touch feedback through `usePressed()` + `[data-pressed=true]` instead of `:active`;
// - every size reaches the 44 px touch target (NFR-01): shadcn's xs, sm, icon-xs and icon-sm
//   are removed rather than kept unused;
// - destructive text uses a palette token, not white.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-100 ease-out outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/40 data-[pressed=true]:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 data-[pressed=true]:bg-primary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40 data-[pressed=true]:bg-destructive/80",
        outline:
          "border border-input bg-input/30 shadow-xs hover:bg-input/50 data-[pressed=true]:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 data-[pressed=true]:bg-accent",
        ghost: "hover:bg-accent/50 hover:text-accent-foreground data-[pressed=true]:bg-accent",
        link: "text-primary underline-offset-4 hover:underline data-[pressed=true]:opacity-70",
      },
      size: {
        default: "h-11 px-5 py-2 has-[>svg]:px-4",
        lg: "h-12 rounded-lg px-6 text-base has-[>svg]:px-5",
        icon: "size-11",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  const pressed = usePressed<HTMLButtonElement>({
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
  });

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      {...pressed}
    />
  );
}

export { Button, buttonVariants };
