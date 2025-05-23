import { heroui } from "@heroui/react";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: "#FFFFFF",
            foreground: "#11181C",
            primary: {
              50: "#E6F1FE",
              100: "#CCE3FD",
              200: "#99C7FB",
              300: "#66ABF9",
              400: "#338FF7",
              500: "#0073F5", // Motionics primary blue
              600: "#005CC4",
              700: "#004593",
              800: "#002E62",
              900: "#001731",
              DEFAULT: "#0073F5",
              foreground: "#FFFFFF"
            }
          }
        }
      }
    })
  ]
};
