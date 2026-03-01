import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        cream: {
          DEFAULT: "#FAF8F5",
          dark: "#F0ECE6",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          light: "#6B6B6B",
        },
        indigo: {
          DEFAULT: "#6B6E8A",
        },
        rust: {
          DEFAULT: "#C45D3E",
          light: "#E8A990",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
