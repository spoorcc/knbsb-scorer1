import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // JSDOM parses + executes the full app for every test; full-game integration runs can
    // legitimately take several seconds under load, well past Vitest's 5s default.
    testTimeout: 20000,
    // Coverage: the app's logic lives entirely in the inline <script> in index.html, executed
    // via jsdom's vm context under a synthetic "http://localhost/" URL — not a real module V8's
    // coverage provider can map source back to, so a meaningful statement/branch % isn't
    // available here. `npm run test:coverage` still runs (and excludes index.html to avoid a
    // noisy parse-error report); breadth of coverage instead comes from the test suite itself
    // exercising every buildBatterEvent/buildRunnerEvent key, state transition, and UI flow.
    coverage: {
      provider: "v8",
      reporter: ["text"],
      exclude: ["index.html", "lint-artifacts/**", "scripts/**"],
    },
  },
});
