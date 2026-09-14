// Brand palette - the single source of truth for the approved colors.
// Mirrored as CSS custom properties in src/app/globals.css and exposed as
// Tailwind theme colors in tailwind.config.ts; use this object only where a
// raw hex is unavoidable (inline SVG, canvas, chart libraries).
export const COLORS = {
  teal: "#00A660", // accent principal - boutons, liens actifs
  onyx: "#111111", // fond sombre
  paper: "#FFFFFF", // texte clair, cartes
  paperDim: "#F9F9F9", // cartes/fond secondaire
  stone: "#6B7280", // texte secondaire
  green: "#A6FA30", // accent rare - alertes positives, à utiliser avec parcimonie
  orange: "#FF5C34", // liens secondaires discrets (JSON backup, toggles récap/archives) - added outside the original strict palette, by explicit request
} as const;

// System font stack (San Francisco on Apple platforms, matching system fonts
// elsewhere) - no web font load, per Apple's own typography guidance.
export const FONT_SYSTEM =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
