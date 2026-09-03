import pluginNext from "@next/eslint-plugin-next";
import { config as reactConfig } from "./react-internal.js";

export const nextJsConfig = [
   ...reactConfig,
   {
      plugins: {
         "@next/next": pluginNext,
      },
      rules: {
         ...pluginNext.configs.recommended.rules,
         ...pluginNext.configs["core-web-vitals"].rules,
      },
   },
];

export const config = nextJsConfig;
export default nextJsConfig;
