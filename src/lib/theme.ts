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

// Outside the official brand palette above (teal/onyx/paper/stone/vert vif)
// - reserved exclusively for the DealCard follow-up ("relance") badge's two
// time-urgency states, by explicit request. Not for any other use case; a
// new need for red/blue elsewhere should get its own explicit exception,
// not silently reuse these. Tailwind classes reference these hexes directly
// via arbitrary-value syntax (e.g. bg-[#D91A2A]/15) rather than through this
// export, since Tailwind's JIT needs the literal hex in the class string -
// this object exists so the two values have one documented source of truth
// instead of being repeated as bare strings at each call site.
export const RELANCE_COLORS = {
  dangerRed: "#D91A2A", // "En retard" - deliberately a different red than
  // DealDrawer's "Marquer perdu" outline button (Tailwind red-400/500) and
  // DealCard's client-dupe warning (Tailwind red-500) - see both files for
  // the shape/fill differences that also keep this visually distinct.
  infoBlue: "#1A6FBF", // "Bientôt" (<=48h)
} as const;

// Outside the official brand palette, reserved exclusively for the
// Pipedrive-import provenance badge ("P") on DealCard/DealDrawer - a third
// explicit exception (after orange and RELANCE_COLORS above), not a general
// purple/violet to reuse elsewhere. Applied inline (style={{backgroundColor}})
// rather than a Tailwind arbitrary-value class since it's only used in two
// places, both already reading from this file.
export const IMPORT_BADGE_COLOR = "#7C3AED";

// Classic traffic-light colors, deliberately distinct from every other
// color in this project - a fourth explicit exception, reserved to
// DealCard's uncontacted-lead-age badge only. By explicit client request:
// instant recognition takes priority over palette consistency for this one
// badge, so this is NOT COLORS.green (#A6FA30 - too lime/neon to read as a
// classic "green light") and NOT RELANCE_COLORS.dangerRed (#D91A2A -
// already reserved to the relance badge, and both can appear on the same
// card at once, e.g. an uncontacted lead with an overdue relance, so
// sharing a hex there would blur two unrelated signals into one).
export const LEAD_AGE_COLORS = {
  green: "#22C55E", // 1-10 days since created_at, uncontacted
  yellow: "#EAB308", // 11-20 days
  red: "#DC2626", // 21-30+ days - stays red indefinitely past 30
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
