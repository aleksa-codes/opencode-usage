# OpenCode Usage

Small OpenCode V2 plugin that shows OpenAI ChatGPT quota in the TUI prompt footer and home-screen status row.
The server part reads OpenCode's active OAuth connection and polls the ChatGPT usage endpoint.
The TUI part renders both the five-hour and weekly windows, with a steady-use marker.

Stack: TypeScript, Bun, OpenCode plugin SDK, OpenTUI, SolidJS.

- OpenCode loads `src/index.ts` and `dist/tui.js` from the package exports in the global config.
- `bun run typecheck` checks the plugin source.
- `bun run format:check` checks formatting. `bun run format` formats the project.
- Run `bun run build:tui` after TUI or shared-source changes and commit `dist/tui.js` for Git installs.
- Keep this task named `build:tui`: npm treats `build` as a Git-dependency preparation trigger.
- The TUI needs Solid compilation: OpenTUI skips its runtime TSX transform inside `node_modules`.
- No test suite is configured. The plugin runs inside the OpenCode TUI.
- No standalone run or lint script exists. Check rendering and behavior in OpenCode.
