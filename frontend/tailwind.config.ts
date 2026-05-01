import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        brand: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
      },
      boxShadow: {
        soft: "0 18px 60px -20px rgba(15, 23, 42, 0.15)",
        glow: "0 10px 40px -10px rgba(244, 63, 94, 0.55)",
        ring: "0 0 0 1px rgba(15, 23, 42, 0.06), 0 10px 30px -15px rgba(15, 23, 42, 0.2)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #f43f5e 0%, #e11d48 45%, #7c3aed 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(124,58,237,0.12) 100%)",
        "app-light":
          "radial-gradient(1200px 600px at 10% -10%, rgba(244,63,94,0.18), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(124,58,237,0.18), transparent 60%), linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)",
        "app-dark":
          "radial-gradient(1200px 600px at 10% -10%, rgba(244,63,94,0.18), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(124,58,237,0.22), transparent 60%), linear-gradient(180deg, #020617 0%, #0b1220 100%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.25)" },
          "100%": { transform: "scale(1)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "pop": "pop 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
