import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        { src: "图片", dest: "." },
        { src: "assets", dest: "." },
      ],
    }),
  ],
  base: process.env.GITHUB_PAGES === "true" ? "/sw/" : "./",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 4173,
  },
});
