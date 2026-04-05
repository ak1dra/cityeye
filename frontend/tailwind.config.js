/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        city: {
          bg: '#eef0eb',
          surface: '#ffffff',
          surface2: '#f8f9f6',
          border: '#e2e8e0',
          'border-hover': '#c8d4c4',
          text: '#0f172a',
          muted: '#64748b',
          subtle: '#94a3b8',
        },
        severity: {
          critical: '#dc2626',
          high: '#d97706',
          medium: '#2563eb',
          low: '#7c3aed',
          resolved: '#16a34a',
        },
      },
      boxShadow: {
        matte: '0 10px 24px rgba(15,23,42,0.08)',
        'matte-lg': '0 18px 40px rgba(15,23,42,0.12)',
        'matte-xl': '0 18px 48px rgba(15,23,42,0.12)',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
