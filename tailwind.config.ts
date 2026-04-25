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
        // izipizi brand colors (from BrandBook 2023)
        brand: {
          50:  "#f0fef7",
          100: "#d0fce8",
          200: "#a3f8d3",
          300: "#69f5b8",
          400: "#53f3a4",  // izipizi green #53F3A4
          500: "#0dd171",
          600: "#00a652",
          700: "#008542",
          800: "#006b35",
          900: "#00582d",
          950: "#192635",  // izipizi dark navy #192635
        },
        // izipizi secondary purple #AD47FF
        purple: {
          50:  "#faf0ff",
          100: "#f2d9ff",
          200: "#e5b3ff",
          300: "#d47dff",
          400: "#ad47ff",  // izipizi purple #AD47FF
          500: "#9020f0",
          600: "#7a0fd4",
          700: "#6409ad",
          800: "#510689",
          900: "#420570",
        },
        dark: "#192635",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
