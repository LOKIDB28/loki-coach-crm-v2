import type { Config } from "tailwindcss";

// Colors ported 1:1 from the original prototype's COLORS object (loki-coach-crm.jsx).
// Keep these in sync with src/lib/theme.ts.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#15120E",
        surface: "#1F1B15",
        surface2: "#28221A",
        border: "#3A3226",
        brass: "#C6A15B",
        brassSoft: "#E4C989",
        text: "#F3EFE6",
        textSoft: "#A79C89",
        textFaint: "#736A58",
      },
      fontFamily: {
        condensed: ["Barlow Condensed", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
