# OpenCode Usage

A small OpenCode V2 plugin that adds OpenAI ChatGPT quota to the TUI prompt footer
and home-screen status row.
It shows the 5-hour and weekly usage windows side by side, including reset countdowns and
the white steady-use marker.

## Background

Based on [opencode-quota](https://github.com/slkiser/opencode-quota), whose multi-provider
focus felt more complex than I needed. I wanted a smaller plugin focused on showing both
the 5-hour and weekly (7-day) limits side by side in the status line, a layout I was missing
in opencode-quota.

Currently, only OpenAI ChatGPT quota is supported. Contributions adding support for other
providers are welcome.

## Authentication

Requires the legacy Codex OAuth login in OpenCode: `/connect` → OpenAI → Codex browser (legacy)
or Codex device code (legacy). The ChatGPT usage endpoint rejects the newer “Sign in with ChatGPT”
token and OpenAI API-key logins. The plugin reads the active credential through OpenCode and does
not run the Codex CLI.

## How it works

- Reads the active OpenAI OAuth login through OpenCode's integration API.
- Checks both windows one second after a session execution ends, with a 30-second request cooldown.
  Replies inside the cooldown queue a follow-up check instead of leaving the cached values in place.
- Checks periodically every five minutes and updates the countdowns every minute. Failed checks back
  off for at least five minutes, honoring a longer `Retry-After` when rate limited.
- Keeps the last successful values visible if a later check fails.
- When space is tight, drops the bars before shortening labels so percentages and reset countdowns
  stay visible as long as possible. In sessions, drops reset countdowns next and hides quota
  if both percentages still cannot fit.
- Writes no credentials or quota snapshots to disk. OAuth refresh stays with OpenCode.

OpenAI's usage endpoint is undocumented and may change independently of OpenCode.

## Development

```sh
bun install
bun run typecheck
bun run format:check
bun run build:tui
```

OpenCode loads the package's server and TUI exports directly from its global configuration.
The TUI export is precompiled with Solid because Git-installed packages live in `node_modules`,
where OpenTUI skips runtime TSX compilation. Rebuild and commit `dist/tui.js` after changing the
TUI or its shared sources. No install-time build or publishing is required.

## License

[MIT](./LICENSE).
