/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#3b82f6", dark: "#1d4ed8" },
        surface: { DEFAULT: "#0f1525", deep: "#0a0e1a" },
        border: { DEFAULT: "#1e2a45" },
      },
      fontFamily: {
        sans: ["'Segoe UI'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
