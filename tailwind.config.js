/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // SR design tokens (dark theme)
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          500: '#60A5FA',
          600: '#3B82F6',
          700: '#2563EB',
        },
        surface: {
          DEFAULT: '#0F172A',
          card:    '#1E293B',
          card2:   '#293548',
          input:   '#1E293B',
          border:  'rgba(255,255,255,0.07)',
        },
        ink: {
          DEFAULT: '#F1F5F9',
          2: '#CBD5E1',
          3: '#64748B',
          4: '#334155',
        },
        sr: {
          green:      '#34D399',
          greenLight: '#064E3B',
          amber:      '#FCD34D',
          amberLight: '#451A03',
          red:        '#F87171',
          redLight:   '#450A0A',
          blue:       '#60A5FA',
          blueLight:  '#1E3A5F',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'System'],
        display: ['Barlow Condensed', 'System'],
      },
      borderRadius: {
        'sr': '20px',
      },
    },
  },
  plugins: [],
};
