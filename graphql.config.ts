import { resolve } from "node:path";
import { config as initEnv } from "dotenv";
import type { IGraphQLConfig } from "graphql-config";

// Load environment variables
initEnv({ path: resolve(process.cwd(), ".env") });
initEnv({ path: resolve(process.cwd(), ".env.local") });

const API_VERSION = "2025-10";
const MONDAY_API_URL = "https://api.monday.com/v2";

const config: IGraphQLConfig = {
  projects: {
    monday: {
      schema: {
        [MONDAY_API_URL]: {
          headers: {
            "API-Version": API_VERSION,
            Authorization: process.env.MONDAY_ACCESS_TOKEN ?? "",
          },
        },
      },
    },
  },
};

export { config as defaultGraphQLConfig };
export default config;
