import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive";
type ButtonSize = "compact" | "normal" | "large";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** "pill" keeps the login page's approved 11px radius instead of the default rounded-lg - the one documented exception (see login/page.tsx). */
  radius?: "default" | "pill";
  /**
   * false opts out of the default 44px mobile touch-target minimum,
   * keeping the size's compact padding on every viewport instead. Use
   * only when a non-Button sibling element this one must stay
   * visually matched to (height, padding) can't take the same
   * treatment - at that point apply this size's own classes (see
   * SIZE_CLASSES below) directly to the sibling instead, so both grow
   * to 44px on mobile together rather than one of them opting out.
   */
  minTouchTarget?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-teal text-white hover:bg-teal/90",
  secondary: "border border-border/20 text-textSoft hover:text-text hover:border-teal/40",
  destructive: "border border-red-400/40 text-red-500 hover:bg-red-500/10",
};

const SIZE_CLASSES: Record<ButtonSize, { touch: string; compact: string }> = {
  compact: {
    touch: "min-h-11 px-3.5 text-xs sm:min-h-0 sm:py-1.5 sm:px-3",
    compact: "px-3 py-2 text-xs",
  },
  normal: {
    touch: "min-h-11 px-4 text-xs sm:min-h-0 sm:py-2 sm:px-4",
    compact: "px-4 py-2 text-xs",
  },
  large: {
    touch: "min-h-12 px-5 text-sm sm:min-h-0 sm:py-2.5 sm:px-5",
    compact: "px-5 py-2.5 text-sm",
  },
};

const RADIUS_CLASSES = {
  default: "rounded-lg",
  pill: "rounded-[11px]",
} as const;

/**
 * Shared button - primary (teal) / secondary (outline) / destructive
 * (outline red) variants, 3 sizes, all collapsing from a 44px mobile
 * touch target to compact desktop padding past the sm: breakpoint by
 * default (same mechanism as the pre-existing page.tsx "Nouveau client"
 * button this generalizes). Reuses Lot 1's disabled: opacity token and
 * defines no focus ring of its own - the global :focus-visible rule in
 * globals.css (specificity 0,1,0) is what applies, since this component
 * adds no competing focus/focus-visible class of its own.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "normal",
    radius = "default",
    minTouchTarget = true,
    className = "",
    type = "button",
    ...props
  },
  ref
) {
  const sizeClasses = minTouchTarget ? SIZE_CLASSES[size].touch : SIZE_CLASSES[size].compact;
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${sizeClasses} ${RADIUS_CLASSES[radius]} ${className}`}
      {...props}
    />
  );
});
