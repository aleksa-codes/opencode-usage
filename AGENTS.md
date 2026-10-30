# OpenCode Usage

Small OpenCode V2 plugin that shows OpenAI ChatGPT quota in the TUI prompt footer.
The server part reads OpenCode's active OAuth connection and polls the ChatGPT usage endpoint.
The TUI part renders both the five-hour and weekly windows, with a steady-use marker.

Stack: TypeScript, Bun, OpenCode plugin SDK 2.2.4, SolidJS, Zod.

- OpenCode loads `src/index.ts` and `src/tui.tsx` from the package exports in the global config.
- `bun run typecheck` checks the plugin source.
- `bun run format:check` checks formatting. `bun run format` formats the project.
- No build step is needed. OpenCode loads the TypeScript source directly.
- No test suite is configured. The plugin runs inside the OpenCode TUI.
