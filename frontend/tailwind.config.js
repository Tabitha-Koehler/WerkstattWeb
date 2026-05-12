/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: '#1d4ed8', light: '#3b82f6', dark: '#1e3a8a' },
        warning:  { DEFAULT: '#ea580c', light: '#fed7aa', dark: '#9a3412' },
        success:  { DEFAULT: '#16a34a', light: '#dcfce7', dark: '#14532d' },
        danger:   { DEFAULT: '#dc2626', light: '#fee2e2', dark: '#7f1d1d' },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
