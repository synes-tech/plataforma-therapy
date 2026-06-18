import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // === UNITHERY — Visual Identity ===

        // Primary: Azul Tech vibrante (#1A86E2)
        primary: {
          DEFAULT: '#1A86E2',
          light: '#4DA3ED',
          dark: '#1470C4',
          50: '#EBF5FE',
          100: '#D6EBFC',
          200: '#A8D5F9',
          500: '#1A86E2',
          600: '#1470C4',
          700: '#0F5A9E',
        },

        // Deep Charcoal — textos estruturais e dark mode
        charcoal: {
          DEFAULT: '#0F172A',
          light: '#1E293B',
          muted: '#475569',
        },

        // Verde Menta Calmante — evolução positiva
        mint: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
          50: '#ECFDF5',
        },

        // Lavender / Ice Blue — fundos neutros suaves
        ice: {
          DEFAULT: '#F0F4F8',
          light: '#F8FAFC',
          dark: '#E2E8F0',
        },

        // Accent: Violeta suave para IA
        ai: {
          DEFAULT: '#7C3AED',
          light: '#A78BFA',
          50: '#F5F3FF',
          glow: 'rgba(124, 58, 237, 0.1)',
        },

        // Alert/Crisis: Âmbar suave
        alert: {
          DEFAULT: '#F59E0B',
          light: '#FDE68A',
          bg: '#FFFBEB',
        },

        // Sucesso
        success: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
        },

        // Erro
        error: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
        },

        // Superfícies
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F8FAFC',
          tertiary: '#F1F5F9',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(15, 23, 42, 0.04)',
        'card': '0 4px 16px rgba(15, 23, 42, 0.06)',
        'elevated': '0 8px 32px rgba(15, 23, 42, 0.08)',
        'ai-glow': '0 0 20px rgba(26, 134, 226, 0.15)',
      },
      backgroundImage: {
        'ai-gradient': 'linear-gradient(135deg, #1A86E2 0%, #7C3AED 100%)',
        'ai-gradient-subtle': 'linear-gradient(135deg, rgba(26, 134, 226, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%)',
        'wave-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20c5.5 0 5.5-3 11-3s5.5 3 11 3 5.5-3 11-3 5.5 3 11 3v3c-5.5 0-5.5-3-11-3s-5.5 3-11 3-5.5-3-11-3-5.5 3-11 3v-3z' fill='%231A86E2' fill-opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-soft': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
