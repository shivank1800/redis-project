import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** Browser calls same origin; Vite forwards to FastAPI (fixes LAN / non-localhost dev URLs). */
const API_PREFIXES = [
  "auth",
  "users",
  "posts",
  "feed",
  "notifications",
  "analytics",
  "health",
  "metrics",
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: Object.fromEntries(
        API_PREFIXES.map((prefix) => [
          `/${prefix}`,
          {
            target: backendTarget,
            changeOrigin: true,
            ws: prefix === "notifications",
          },
        ]),
      ),
    },
  };
});
