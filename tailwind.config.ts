import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // izipizi brand: dark charcoal + teal/cyan
        brand: {
          50: "#effefb",
          100: "#c8fff7",
          200: "#92feef",
          300: "#55f5e6",
          400: "#20e2d4",
          500: "#00c4b8",
          600: "#009e96",
          700: "#007d78",
          800: "#00635f",
          900: "#00514e",
          950: "#1b2a2a",
        },
        dark: "#1a1f2e",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
