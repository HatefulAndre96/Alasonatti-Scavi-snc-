/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF6600',
          blue: '#002D62',
          black: '#0a0a0a',
          gray: '#374151',
          light: '#F3F4F6'
        }
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body: ['Open Sans', 'sans-serif']
      }
    }
  },
  plugins: []
}
