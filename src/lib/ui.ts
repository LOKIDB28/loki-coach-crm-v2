/**
 * Shared chrome for a floating popover panel (radius, border, background,
 * shadow) - not the content styling (padding/text/animation), which stays
 * at each call site since it genuinely differs: WidgetInfoTooltip holds a
 * paragraph of explanatory text, the mobile "..." menu holds a list of
 * action rows. The shadow matches HoverTooltip's (src/components/
 * HoverTooltip.tsx) - a two-layer soft shadow, visibly deeper than
 * Tailwind's shadow-lg, which both of these previously used independently
 * before this shared constant existed.
 */
export const POPOVER_CHROME =
  "rounded-lg border border-border/15 bg-surface shadow-[0_12px_24px_-10px_rgb(0_0_0_/_0.35),0_4px_10px_-4px_rgb(0_0_0_/_0.25)]";
