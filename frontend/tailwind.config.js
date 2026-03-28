/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'action-blue': '#8B35D9',
        'brand-purple': '#8B35D9',
        'brand-blue': '#29AAEB',
        'cupertino-grey': '#F2F2F7',
        'cupertino-label': '#8E8E93',
        'cupertino-blue': '#8B35D9',
        'primary': '#000000',
        'on-primary': '#ffffff',
        'surface': '#ffffff',
        'on-surface': '#000000',
        'on-surface-variant': '#3A3A3C',
        'background': '#ffffff',
        'on-background': '#1a1a1a',
        'surface-container': '#f2f2f7',
        'surface-container-low': '#f9f9f9',
        'outline-variant': '#e5e5ea',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        cupertino: '12px',
        xl: '20px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
