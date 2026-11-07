# OpenCode Usage

A small OpenCode V2 plugin that shows your remaining OpenAI ChatGPT quota.
See both the **5-hour and weekly (7-day) limits side by side**, in the session
prompt footer and the home-screen status row.

Based on [opencode-quota](https://github.com/slkiser/opencode-quota). Its
multi-provider focus felt more complex than I needed. I wanted a smaller plugin
with both limits side by side in the status line, a layout I was missing there.

## What it shows

- Remaining percentages, usage bars, and reset countdowns for both limits.
- A white marker on each bar to help you pace usage until the next reset.
- A smaller display when space is tight: bars disappear first, then labels shorten.
  In sessions, countdowns disappear next. If both percentages still cannot fit,
  the quota display is hidden instead of cut off.

Only OpenAI ChatGPT is supported today. Contributions for other providers are welcome.

## Sign in

Use a **legacy Codex login** in OpenCode:

1. Run `/connect` and choose **OpenAI**.
2. Choose **Codex browser (legacy)** or **Codex device code (legacy)**.

The newer “Sign in with ChatGPT” login and OpenAI API keys do not work with the
ChatGPT usage endpoint. The plugin uses your active OpenCode login; it does not
run the Codex CLI.

## Updates and privacy

Quota refreshes one second after a session execution ends and every five minutes
in the background. Requests have a 30-second cooldown. If a reply finishes during
that cooldown, a follow-up check is queued. Countdown text updates every minute.

If a check fails, the last successful values stay visible. Retries wait at least
five minutes, or longer if OpenAI sends a `Retry-After` rate-limit response.

The plugin reads credentials through OpenCode's integration API and writes neither
credentials nor quota snapshots to disk. OpenCode handles OAuth token refresh.

**Note:** OpenAI's usage endpoint is undocumented and may change independently
of OpenCode.

## Development

```sh
bun install
bun run typecheck
bun run format:check
bun run build:tui
```

OpenCode loads the package's server and TUI exports through its global plugin
configuration. No publishing or install-time build is required.

**After changing the TUI or shared sources, rebuild and commit `dist/tui.js`.**
The TUI is precompiled with Solid because Git-installed packages live in
`node_modules`, where OpenTUI skips runtime TSX compilation.

No automated test suite is configured. Check rendering and behavior inside the
OpenCode TUI.

## License

[MIT](./LICENSE).
