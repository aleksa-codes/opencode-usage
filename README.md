# OpenCode Usage

A small OpenCode V2 TUI plugin showing **remaining 5-hour and weekly (7-day) ChatGPT
quota side by side**, in sessions and on the home screen.
For the terminal interface, not the desktop app.

Based on [opencode-quota](https://github.com/slkiser/opencode-quota). This
version keeps both limits in the status line without adding a sidebar.

| Session                                                                | Home                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ![ChatGPT quota in the session prompt footer](docs/images/session.png) | ![ChatGPT quota in the home-screen status row](docs/images/home.png) |

Percentages, bars, reset countdowns, and a theme-aware pacing marker. Adapts to narrow windows.
**OpenAI ChatGPT only.** Contributions for other providers are welcome.

## Install

Requires OpenCode V2. Choose one installation method.

### From GitHub

```sh
opencode plugin add github:aleksa-codes/opencode-usage
```

OpenCode installs the plugin globally. No clone or build is needed.

### From a local checkout

```sh
git clone https://github.com/aleksa-codes/opencode-usage.git
cd opencode-usage
bun install --frozen-lockfile
bun run build:tui
pwd
```

Add the absolute path printed by `pwd` to the `plugins` array in
`~/.config/opencode/opencode.json` (or `opencode.jsonc` if you use that):

```json
{
  "plugins": ["/absolute/path/to/opencode-usage"]
}
```

Keep your other plugin entries, but remove the GitHub entry for this plugin if
you are switching to a local checkout. Point at the checkout directory, not
`dist/tui.js`, so OpenCode loads both the server and TUI parts.

## Sign in

`/connect` → **OpenAI** → **Codex browser (legacy)** or **Codex device code (legacy)**.

**OAuth is required; API keys are not supported.** Use a legacy Codex login if
the newer “Sign in with ChatGPT” login cannot fetch quota. The plugin accepts
OpenCode's active OAuth credential, but OpenAI decides whether it can access usage.
Uses your OpenCode login, not the Codex CLI. The plugin writes no credentials or
quota data to disk; OpenCode manages stored login credentials.

Open the OpenCode TUI (or run `/reload` if it is already open). Once signed in,
look for both quota windows on the home screen and in the session footer.

## Refresh, display, and privacy

- Requests a quota check one second after session execution ends and every five minutes
  while the display is mounted. A 30-second cooldown or error backoff can delay the
  actual request. Replies during the cooldown queue a follow-up check. Countdowns
  update every minute.
- Failed checks keep the last values visible. Retries wait at least five minutes,
  or longer if OpenAI sends a `Retry-After` response.
- Narrow layouts drop bars, then shorten labels. Sessions also drop countdowns,
  then hide quota if both percentages cannot fit.
- Bar markers use the theme's background color and help pace usage until reset.
  Credentials come from OpenCode's integration API; OpenCode handles OAuth refresh.
- OpenAI's usage endpoint is undocumented and may change independently of OpenCode.

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

## For agents

See [AGENTS.md](AGENTS.md) for local checks and the TUI bundle requirements.

## License

[MIT](LICENSE)
