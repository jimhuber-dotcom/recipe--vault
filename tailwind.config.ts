import type { Config } from "tailwindcss";

/**
 * Design tokens live as CSS custom properties in app/globals.css (:root).
 * Tailwind references them here so every utility class resolves to the same
 * single source of truth. Change a color once in globals.css and it updates
 * everywhere.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: {
          DEFAULT: "var(--color-surface)",
          muted: "var(--color-surface-muted)",
        },
        border: "var(--color-border)",
        foreground: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          foreground: "var(--color-primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          foreground: "var(--color-accent-foreground)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          soft: "var(--color-success-soft)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          soft: "var(--color-danger-soft)",
        },
        ring: "var(--color-ring)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(42, 38, 32, 0.04), 0 12px 28px -16px rgba(42, 38, 32, 0.18)",
        "card-hover":
          "0 1px 2px rgba(42, 38, 32, 0.05), 0 18px 40px -18px rgba(42, 38, 32, 0.25)",
      },
      maxWidth: {
        content: "80rem",
      },
    },
  },
  plugins: [],
};

export default config;
