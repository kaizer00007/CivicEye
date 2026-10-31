/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        civic: {
          blue:   '#2563eb',
          green:  '#16a34a',
          red:    '#dc2626',
          orange: '#ea580c',
          yellow: '#ca8a04',
          gray:   '#6b7280',
        },
      },
    },
  },
  plugins: [],
};
