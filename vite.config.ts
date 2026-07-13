import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import vue from "@vitejs/plugin-vue";
import { viteStaticCopy } from "vite-plugin-static-copy";

const catalog = JSON.parse(readFileSync(new URL("./src/data/generated/catalog.json", import.meta.url), "utf8")) as {
  evidence: Array<{ sourcePath: string }>;
  gemMarketSnapshots: Array<{ sourceImage: string }>;
  skills: Array<{ icon: string }>;
};
const runtimeAssets = Array.from(new Set([
  ...catalog.evidence.map((row) => row.sourcePath),
  ...catalog.gemMarketSnapshots.map((row) => row.sourceImage),
  ...catalog.skills.map((row) => row.icon),
].map((value) => value.replace(/^\.\//, ""))));

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        ...runtimeAssets.map((src) => ({ src, dest: "." })),
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
