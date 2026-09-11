import type { Config } from "tailwindcss";

// Semantic tokens resolve to CSS custom properties (see globals.css) so the
// same class names (bg-surface, text-text, border-border, …) work in both
// light and dark automatically via prefers-color-scheme. Brand colors
// (teal/onyx/paper/paperDim/stone/green) are the fixed palette; keep them in
// sync with src/lib/theme.ts.
const config: Config = {
  darkMode: "media",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: "#00A660",
        onyx: "#111111",
        paper: "#FFFFFF",
        paperDim: "#F9F9F9",
        stone: "#6B7280",
        green: "#A6FA30",

        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        textSoft: "rgb(var(--text-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Text'",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
