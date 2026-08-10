import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    // The app's only real source file is the inline <script> block in
    // index.html. `npm run lint:js` extracts it to
    // lint-artifacts/index.inline.js (via scripts/extract-inline-script.mjs)
    // before ESLint runs, since ESLint has no first-party way to lint script
    // content embedded in HTML.
    files: ["lint-artifacts/index.inline.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.mjs", "analysis/**/*.mjs", "vitest.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
];
