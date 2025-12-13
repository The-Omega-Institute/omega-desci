import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function getBase() {
  const explicit = process.env.VITE_BASE?.trim();
  if (explicit) return explicit.endsWith("/") ? explicit : `${explicit}/`;

  const repo = process.env.GITHUB_REPOSITORY?.split("/")?.[1];
  if (repo) return `/${repo}/`;

  return "/";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: getBase(),
    server: {
      port: 5173,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
        "next/navigation": path.resolve(__dirname, "lib/mocks/navigation.ts"),
        "next/link": path.resolve(__dirname, "lib/mocks/link.tsx"),
        "next/font/google": path.resolve(__dirname, "lib/mocks/font.ts"),
        "next/image": path.resolve(__dirname, "lib/mocks/image.tsx"),
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "gh-pages.html"),
        },
      },
    },
  };
});
