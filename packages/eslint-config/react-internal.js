import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { config as baseConfig } from "./base.js";

export const config = [
   ...baseConfig,
   pluginReact.configs.flat.recommended,
   {
      languageOptions: {
         globals: {
            ...globals.browser,
         },
      },
      plugins: {
         "react-hooks": pluginReactHooks,
      },
      settings: { react: { version: "detect" } },
      rules: {
         ...pluginReactHooks.configs.recommended.rules,
         "react/react-in-jsx-scope": "off",
         "react/prop-types": "off",
      },
   },
];
