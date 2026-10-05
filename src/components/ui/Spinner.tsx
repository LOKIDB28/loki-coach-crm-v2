interface SpinnerProps {
  size?: number;
  className?: string;
}

/**
 * Native-CSS spinner (Tailwind's built-in animate-spin keyframe, no
 * animation library). Color comes from `currentColor`, so it always
 * matches whatever text color it's placed next to - no separate color
 * prop needed. Decorative only (always paired with a text label that
 * already names the state), so aria-hidden.
 */
export function Spinner({ size = 13, className = "" }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`spinner inline-block shrink-0 rounded-full border-2 border-current/25 border-t-current animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
