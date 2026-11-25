import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Skanor design tokens — source: CLAUDE.md ("Nexo-style theme") and
 * design/StyleGuide.dc.html. No blue accents: black does the work, lilac is
 * only for "info" and soft fills. The Sky/Blush/Lilac stops exist for the
 * marble gradient only.
 */
const marble = {
  base: "#EEF2FF",
  image: [
    "radial-gradient(55% 60% at 12% 18%, #AFCBFF 0%, rgba(175,203,255,0) 70%)",
    "radial-gradient(45% 55% at 88% 22%, #F6B8DA 0%, rgba(246,184,218,0) 70%)",
    "radial-gradient(55% 60% at 72% 88%, #CDBDFF 0%, rgba(205,189,255,0) 70%)",
    "radial-gradient(45% 50% at 18% 90%, #F8C6D6 0%, rgba(248,198,214,0) 70%)",
  ].join(", "),
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0E0E10", 2: "#2A2A30" }, // headlines, primary buttons, active
        graphite: "#3D3D45", // body text
        muted: "#6B6B75", // labels
        faint: "#9A9AA3", // disabled / tertiary
        line: { DEFAULT: "#E7E7EB", soft: "#F1F1F3" }, // borders
        mist: "#F1F1F3", // fills, badges, active rows
        paper: "#FAFAFA", // page
        surface: "#FFFFFF",
        track: "#D6D6DC", // switch "off"
        thead: "#F6F6F8", // table head
        // marble stops (decoration only)
        sky: "#AFCBFF",
        blush: "#F6B8DA",
        lilac: "#CDBDFF",
        // status pills: bg / text
        success: { bg: "#E3F2EA", fg: "#1F6B45" },
        warning: { bg: "#FDF0E1", fg: "#8A4A06" },
        danger: { bg: "#FBE4E1", fg: "#A8321F" },
        info: { bg: "#F3EEFF", fg: "#5B45B8" },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", '"Noto Sans Tamil"', '"Noto Sans Devanagari"', "Nirmala UI", "sans-serif"],
        display: ['"Inter Tight Variable"', '"Inter Tight"', '"Inter Variable"', "Inter", "sans-serif"],
      },
      fontSize: {
        // 11px caps label (".k" in the style guide)
        label: ["11px", { lineHeight: "1.3", letterSpacing: "0.04em", fontWeight: "600" }],
      },
      letterSpacing: {
        display: "-0.045em",
        heading: "-0.04em",
        sub: "-0.035em",
      },
      borderRadius: {
        input: "12px",
        card: "16px",
        panel: "20px",
        hero: "24px",
        frame: "28px",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(90,80,180,.18)",
        knob: "0 1px 2px rgba(0,0,0,.25)",
      },
      maxWidth: { frame: "1280px" },
      spacing: {
        // horizontal page gutter used by every marketing section
        gutter: "clamp(20px, 5vw, 64px)",
        // tighter gutter inside grid cells
        cell: "clamp(20px, 2.4vw, 32px)",
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        // Hero frames, plan cards, scan-page headers. One marble area per screen.
        ".bg-marble": { backgroundColor: marble.base, backgroundImage: marble.image },
        // Small variant used by the sidebar upgrade card.
        ".bg-marble-soft": {
          backgroundColor: "#F3F0FF",
          backgroundImage:
            "radial-gradient(60% 80% at 10% 10%, #E6DEFF, rgba(230,222,255,0) 70%), radial-gradient(60% 80% at 90% 90%, #FBDDEC, rgba(251,221,236,0) 70%)",
        },
        // The round marble dot inside the "+ New" / eyebrow badge.
        ".bg-marble-dot": {
          backgroundImage: "radial-gradient(circle at 30% 30%, #AFCBFF, #F6B8DA 55%, #CDBDFF)",
        },
      });
    }),
  ],
};

export default config;
