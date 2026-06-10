/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans Variable"', '"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Surface
        canvas: '#ffffff',
        surface: '#f5f5f5',
        'surface-soft': '#fafafa',
        hairline: '#e6e6e6',
        'hairline-soft': '#f0f0f0',
        // Text
        ink: '#1a1a1a',
        'ink-strong': '#000000',
        charcoal: '#333333',
        slate: '#555555',
        steel: '#777777',
        stone: '#999999',
        muted: '#aaaaaa',
        // Brand / product accents (reserved for identity moments)
        coral: '#f9503b',
        magenta: '#e83a9c',
        brandblue: '#2b59ff',
        'brandblue-deep': '#1d4ed8',
        purple: '#7c3aed',
        // Semantic
        'success-bg': '#e6f4ea',
        'success-text': '#137333',
        danger: '#d45656',
      },
      borderRadius: {
        hero: '32px',
      },
      boxShadow: {
        card: '0 4px 6px 0 rgba(0,0,0,0.06)',
        subtle: '0 1px 2px 0 rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
