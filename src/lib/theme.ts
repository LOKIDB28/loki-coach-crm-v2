// Ported exactly from the COLORS object in the legacy loki-coach-crm.jsx
// prototype. Mirrored as Tailwind theme colors in tailwind.config.ts
// (bg/surface/surface2/border/brass/brassSoft/text/textSoft/textFaint) -
// use the Tailwind utility classes in components; this object is kept for
// any spot that needs the raw hex (inline SVG, canvas, charts, etc).
export const COLORS = {
  bg: "#15120E",
  surface: "#1F1B15",
  surface2: "#28221A",
  border: "#3A3226",
  brass: "#C6A15B",
  brassSoft: "#E4C989",
  text: "#F3EFE6",
  textSoft: "#A79C89",
  textFaint: "#736A58",
} as const;

// Google Fonts stack, loaded via <link> tags in src/app/layout.tsx (Next.js
// font loading is CSP-friendlier than a raw @import, same visual result).
export const FONT_HEADING = "'Barlow Condensed', sans-serif";
export const FONT_BODY = "'Inter', sans-serif";
