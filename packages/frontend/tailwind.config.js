/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          950: "#1E1B4B",
        },
        accent: {
          50: "#FEFCE8",
          100: "#FEF9C3",
          200: "#FEF08A",
          300: "#FDE047",
          400: "#FACC15",
          500: "#EAB308",
          600: "#CA8A04",
          700: "#A16207",
          800: "#854D0E",
          900: "#713F12",
          950: "#422006",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', '"DM Sans"', "system-ui", "sans-serif"],
      },
      animation: {
        "tip-glow": "tip-glow 2.5s ease-in-out infinite",
      },
      keyframes: {
        "tip-glow": {
          "0%, 100%": { boxShadow: "0 0 16px 2px rgba(251, 191, 36, 0.45)" },
          "50%": { boxShadow: "0 0 22px 4px rgba(251, 191, 36, 0.70)" },
        },
      },
    },
  },
  plugins: [],
};
