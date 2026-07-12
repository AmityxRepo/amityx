/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Placeholder brand palette — superseded by app/DESIGN.md (T-004 design-system skill).
        brand: {
          50: '#f1faea',
          100: '#e2f4cc',
          500: '#3f8f74',
          600: '#2e6b5a',
          700: '#245546',
          800: '#1c4436',
        },
      },
    },
  },
  plugins: [],
}
