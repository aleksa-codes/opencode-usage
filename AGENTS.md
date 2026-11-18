# OpenCode Usage

OpenCode V2 plugin that displays ChatGPT quota in the terminal. The server
reads the active OpenCode OAuth connection; the Solid TUI calls it via RPC.

- Run `bun run typecheck` and `bun run format:check`. There is no standalone
  run, lint, or test script.
- Run `bun run build:tui` after TUI or shared-source changes and include
  `dist/tui.js` in the patch for Git installs.
- Keep this task named `build:tui`: npm treats `build` as a Git-dependency preparation trigger.
- The TUI needs Solid compilation: OpenTUI skips its runtime TSX transform inside `node_modules`.
- Do not change the daily-driver OpenCode config or use live OAuth to verify
  a patch. Use a separate test setup for TUI behavior checks.
