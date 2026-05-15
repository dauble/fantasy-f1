/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'f1-red': '#E10600',
        'f1-red-dark': '#C00500',
        'f1-red-light': '#FF1E00',
        'f1-black': '#15151E',
        'f1-surface': '#1E1E2E',
        'f1-elevated': '#2A2A3A',
        'f1-border': '#3A3A4A',
        'f1-muted': '#8F8FA0',
      },
      fontFamily: {
        'f1': ['"Barlow"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}
