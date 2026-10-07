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
          DEFAULT: '#0a7756', // Exact dark green
          light: '#139e76',
          dark: '#07563e',
        },
        accent: {
          DEFAULT: '#f43f5e',
        }
      },
      fontFamily: {
        sans: ['"Hind Siliguri"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
