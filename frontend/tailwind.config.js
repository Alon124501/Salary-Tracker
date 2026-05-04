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
      boxShadow: {
        'card': '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.08)',
        'float': '0 20px 40px rgba(26,28,29,0.08)',
        'brand': '0 8px 24px rgba(139,53,217,0.28)',
        'modal': '0 24px 64px rgba(0,0,0,0.12)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translate(-50%, 12px)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.25s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
