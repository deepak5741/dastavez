// https://nuxt.com/docs/api/configuration/nuxt-config
const indicFonts = [
  "Noto+Sans+Devanagari", "Noto+Sans+Gujarati", "Noto+Sans+Bengali", "Noto+Sans+Gurmukhi", "Noto+Sans+Oriya",
  "Noto+Sans+Tamil", "Noto+Sans+Telugu", "Noto+Sans+Kannada", "Noto+Sans+Malayalam",
].map((f) => `family=${f}:wght@400;700`).join("&");

export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    // Server-only. Override with NUXT_API_BASE.
    apiBase: "http://localhost:8000",
  },

  app: {
    head: {
      titleTemplate: (title) => (title ? `${title} · Dastavez` : "Dastavez · Govt documents, step by step"),
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        {
          name: "description",
          content:
            "Search any Indian government document (passport, Aadhaar, driving licence, PAN, voter ID and more) and follow the full application process step by step in 11 Indian languages.",
        },
        { name: "theme-color", content: "#0B6E66" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href:
            `https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@500&${indicFonts}&display=swap`,
        },
      ],
    },
  },

  routeRules: {
    // Pages are rendered on the server per request so content edits show up right away.
    "/**": { ssr: true },
  },

  typescript: { strict: true },
});
