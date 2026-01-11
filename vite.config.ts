import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "./src/ui",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@core": resolve(__dirname, "./src/core"),
      "@types": resolve(__dirname, "./src/types.ts"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
