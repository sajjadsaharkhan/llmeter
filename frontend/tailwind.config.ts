import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        popover: "var(--popover)",
        ring: "var(--ring)",
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-fg)",
          soft: "var(--accent-soft)",
        },
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "zoom-in-95": { from: { transform: "scale(0.97)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        "slide-in-from-right-2": { from: { transform: "translateX(0.5rem)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "zoom-in-95": "zoom-in-95 150ms ease-out",
        "slide-in-from-right-2": "slide-in-from-right-2 180ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
