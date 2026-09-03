import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export const config = [
   {
      ignores: [
         "**/node_modules/**",
         "**/dist/**",
         "**/build/**",
         "**/.next/**",
         "**/coverage/**",
         "**/generated/**",
         "**/*.config.*",
         "**/next-env.d.ts",
      ],
   },
   js.configs.recommended,
   ...tseslint.configs.recommended,
   {
      languageOptions: {
         ecmaVersion: "latest",
         sourceType: "module",
         globals: {
            ...globals.node,
         },
      },
      rules: {
         "no-var": "off",
         "@typescript-eslint/no-explicit-any": "error",
         "@typescript-eslint/no-unused-vars": [
            "error",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
         ],
      },
   },
   eslintConfigPrettier,
];
