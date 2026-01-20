/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      typography: {
        invert: {
          css: {
            pre: {
              backgroundColor: "#0b1220",
              color: "#e5e7eb",
              padding: "1rem",
              borderRadius: "0.75rem",
              overflowX: "auto",
              border: "1px solid rgba(255,255,255,0.08)",
            },
            code: {
              backgroundColor: "transparent",
              color: "#e5e7eb",
              fontWeight: "400",
            },
            "code::before": { content: '""' },
            "code::after": { content: '""' },
          },
        },
      },
    },
  },

  plugins: [],
};
