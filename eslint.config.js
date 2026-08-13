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
  {
    // Playwright automation scripts under .claude/skills/: Node code at the top level, plus
    // page.evaluate() callbacks that run inside the browser and reference both standard browser
    // globals (document, Event, ...) and the app's own page-global identifiers (G, selectSlot,
    // ... — see index.html's top-level `let`/`function` declarations, not window.-prefixed on
    // purpose, per CLAUDE.md's Testing section) — so all three sets apply here, unlike the
    // Node-only block above.
    files: [".claude/skills/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
        G: "readonly",
        selectSlot: "readonly",
      },
    },
  },
];
