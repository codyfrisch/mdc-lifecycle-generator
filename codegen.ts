import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CodegenConfig } from "@graphql-codegen/cli";
import { config as initEnv } from "dotenv";

const API_VERSION = "2025-10";
const MONDAY_API_URL = "https://api.monday.com/v2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

initEnv({ path: resolve(__dirname, ".env.local") });

const config: CodegenConfig = {
  generates: {
    "./src/schema/monday-schema.ts": {
      config: {
        avoidOptionals: false,
        enumsAsConst: true,
      },
      plugins: ["typescript"],
    },
  },
  schema: [
    {
      [MONDAY_API_URL]: {
        headers: {
          "API-Version": API_VERSION,
          Authorization: process.env.MONDAY_ACCESS_TOKEN ?? "",
        },
      },
    },
  ],
};
export default config;
