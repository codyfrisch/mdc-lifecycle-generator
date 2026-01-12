import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import basicSsl from "@vitejs/plugin-basic-ssl";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Strict CSP for localhost-only operation
// wasm-unsafe-eval required for libsodium WebAssembly
// blob: worker-src required for Vite HMR
const devCSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'", // Allow WebAssembly (libsodium)
  "style-src 'self' 'unsafe-inline'", // Svelte uses inline styles
  "connect-src 'self' https: wss:", // Webhooks + Vite HMR WebSocket
  "worker-src 'self' blob:", // Vite HMR workers
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // Only works via HTTP header, not meta tag
].join("; ");

/**
 * Vite plugin to proxy webhook requests server-side, bypassing CORS.
 * In production, monday.com sends webhooks from their backend where CORS isn't a concern.
 * This proxy simulates that behavior for local development.
 */
function webhookProxyPlugin(): Plugin {
  return {
    name: "webhook-proxy",
    configureServer(server) {
      server.middlewares.use("/api/webhook-proxy", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        // Read request body
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }

        try {
          const { targetUrl, payload, jwt } = JSON.parse(body) as {
            targetUrl: string;
            payload: unknown;
            jwt: string;
          };

          if (!targetUrl || !payload || !jwt) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ error: "Missing targetUrl, payload, or jwt" }),
            );
            return;
          }

          // Make the actual webhook request server-side (no CORS)
          const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: jwt,
            },
            body: JSON.stringify(payload),
          });

          const responseBody = await response.text();

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: response.ok,
              status: response.status,
              statusText: response.statusText,
              body: responseBody,
            }),
          );
        } catch (error) {
          res.statusCode = 200; // Return 200 so frontend can parse the error
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              status: 0,
              statusText: "Proxy Error",
              body: "",
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  root: "./src/ui",
  plugins: [svelte(), basicSsl(), webhookProxyPlugin()],
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
    https: true,
    headers: {
      // Security headers for localhost dev server
      "Content-Security-Policy": devCSP,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
});
