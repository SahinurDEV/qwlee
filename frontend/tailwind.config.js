/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "992px",
      xl: "1200px",
      xxl: "1620px",
    },
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      // Type scale (size / line-height): 12 13 14 16 18 20 24 30 36 48.
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        "2xs": ["0.8125rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.015em" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],
        "5xl": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
      },
      backgroundColor: {
        'custom-green': 'rgba(0, 191, 99, 0.5)',
      },
      colors: {
        primary: "#00BF63",
        secondary: "#E6F9EF",
        textGray: "#494949",
      },
    },
  },
  plugins: [],
};
