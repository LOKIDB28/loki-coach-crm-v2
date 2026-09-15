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

// Shared recharts <Tooltip> chrome for every LOKI Intelligence chart. Once a
// <Bar> only colors itself through per-datum <Cell>s (no flat `fill` on the
// <Bar> itself), recharts has no series color to fall back on for the
// tooltip's item text and silently renders it in its own default black -
// unreadable on the app's dark surface. labelStyle/itemStyle below pin both
// the category label and the item row to the app's own text tokens instead
// of leaving either to that default.
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "rgb(var(--surface-2))",
    border: "1px solid rgb(var(--border) / 0.2)",
    borderRadius: 8,
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: {
    color: "rgb(var(--text))",
    fontWeight: 600,
    marginBottom: 2,
  },
  itemStyle: {
    color: "rgb(var(--text-soft))",
  },
} as const;
