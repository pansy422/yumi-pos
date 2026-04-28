/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      // Tracking refinado, replica SF Pro Display/Text. Display = grandes
      // tipográficos (40px+), tight = 20-32px, normal = body, wide = caps.
      letterSpacing: {
        display: '-0.022em',
        'display-tight': '-0.018em',
        tight: '-0.011em',
        normal: '0',
        wide: '0.018em',
        caps: '0.08em',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        brand: {
          1: 'hsl(var(--brand-1))',
          2: 'hsl(var(--brand-2))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      // Sombras tipo iOS: offset Y mayor que blur, opacidad baja. Da
      // sensación de elevación natural, no de "drop shadow".
      boxShadow: {
        soft: '0 1px 2px 0 hsl(224 60% 2% / 0.04), 0 4px 16px -8px hsl(224 60% 2% / 0.08)',
        elev: '0 1px 0 0 hsl(0 0% 100% / 0.6) inset, 0 2px 6px 0 hsl(224 60% 2% / 0.05), 0 12px 32px -12px hsl(224 60% 2% / 0.15)',
        glow: '0 0 0 1px hsl(168 75% 52% / 0.3), 0 0 40px -10px hsl(168 75% 52% / 0.5)',
        // Sombra para el botón "primary" — refleja la del brand color.
        'btn-primary': '0 1px 2px 0 hsl(168 75% 25% / 0.3), 0 4px 12px -4px hsl(168 75% 25% / 0.25)',
      },
      // Easings tipo iOS para microinteracciones consistentes.
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
        emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-soft': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-bottom': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.96)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 240ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'fade-in-soft': 'fade-in-soft 200ms ease-out both',
        'slide-in-bottom': 'slide-in-bottom 320ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'scale-in': 'scale-in 180ms cubic-bezier(0.32, 0.72, 0, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      backgroundImage: {
        'shimmer-gradient':
          'linear-gradient(90deg, transparent, hsl(var(--accent) / 0.6), transparent)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
