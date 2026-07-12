/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <-- YEH LINE ZAROORI HAI DARK MODE KE LIYE
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chatverse: '#4F46E5', 
      }
    },
  },
  plugins: [],
}