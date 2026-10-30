import { Plugin } from "@opencode/plugin"
import { REFRESH_COOLDOWN_MS, UsageRpc, type UsageSnapshot, type UsageWindow } from "./rpc.js"

const OPENAI_INTEGRATIONS = ["openai", "codex", "chatgpt"] as const
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"
const ERROR_RETRY_MS = 5 * 60_000
const REQUEST_TIMEOUT_MS = 8_000
const WINDOW_MS = {
  five_hour: 5 * 60 * 60_000,
  week: 7 * 24 * 60 * 60_000,
}

export default Plugin.define({
  id: "opencode-usage",
  async setup(ctx) {
    let snapshot: UsageSnapshot | undefined
    let nextCheckAt = 0
    let inFlight: Promise<UsageSnapshot> | undefined

    const registration = await ctx.rpc.register(UsageRpc, {
      snapshot: async () => {
        if (inFlight) return inFlight
        if (snapshot && Date.now() < nextCheckAt) return snapshot

        const request = refresh()
        inFlight = request
        try {
          return await request
        } finally {
          if (inFlight === request) inFlight = undefined
        }
      },
    })

    return () => registration.dispose()

    async function refresh(): Promise<UsageSnapshot> {
      const previous = snapshot
      let retryAfterMs = 0

      try {
        const auth = await readOpenAIAuth()
        if (!auth) {
          snapshot = {
            state: "missing",
            windows: [],
            checkedAt: Date.now(),
            stale: false,
            message: "Sign in with OpenAI to show usage",
          }
          nextCheckAt = Date.now() + ERROR_RETRY_MS
          return snapshot
        }

        const response = await fetch(USAGE_URL, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "User-Agent": "OpenCode-Usage/0.1.0",
            ...(auth.accountId ? { "ChatGPT-Account-Id": auth.accountId } : {}),
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })

        if (!response.ok) {
          if (response.status === 429) {
            retryAfterMs = parseRetryAfter(response.headers.get("retry-after"))
          }
          throw new Error(`Usage request failed (${response.status})`)
        }

        const body: unknown = await response.json()
        const windows = parseWindows(body, Date.now())
        if (windows.length === 0) throw new Error("No quota windows returned")

        snapshot = {
          state: "ready",
          windows,
          checkedAt: Date.now(),
          stale: false,
          message: "",
        }
        nextCheckAt = Date.now() + REFRESH_COOLDOWN_MS
        return snapshot
      } catch (error) {
        const failureName = error instanceof Error ? error.name : "UnknownError"
        console.warn(`[opencode-usage] quota refresh failed (${failureName})`)
        nextCheckAt = Date.now() + Math.max(ERROR_RETRY_MS, retryAfterMs)
        snapshot =
          previous?.state === "ready"
            ? { ...previous, stale: true, message: "Showing the last successful check" }
            : {
                state: "error",
                windows: [],
                checkedAt: null,
                stale: false,
                message: "OpenAI usage is temporarily unavailable",
              }
        return snapshot
      }
    }

    async function readOpenAIAuth() {
      const { data } = await ctx.integration.list()
      const available = new Set(data.map((integration) => integration.id))

      for (const id of OPENAI_INTEGRATIONS) {
        if (!available.has(id)) continue
        const connection = await ctx.integration.connection.active(id)
        if (connection?.type !== "credential") continue

        const credential = await ctx.integration.connection.resolve(connection)
        if (credential?.type !== "oauth") continue
        if (credential.expires > 0 && credential.expires <= Date.now()) {
          throw new Error("OpenAI sign-in expired")
        }

        return {
          accessToken: credential.access,
          accountId: accountIdFromToken(credential.access),
        }
      }

      return undefined
    }
  },
})

function accountIdFromToken(token: string) {
  const encoded = token.split(".")[1]
  if (!encoded) return undefined

  try {
    const base64 = encoded.replace(/-/gu, "+").replace(/_/gu, "/")
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!isRecord(payload)) return undefined

    const auth = payload["https://api.openai.com/auth"]
    if (!isRecord(auth) || typeof auth.chatgpt_account_id !== "string") return undefined
    return auth.chatgpt_account_id
  } catch {
    return undefined
  }
}

function parseWindows(body: unknown, now: number): UsageWindow[] {
  if (!isRecord(body) || !isRecord(body.rate_limit)) return []

  return [body.rate_limit.primary_window, body.rate_limit.secondary_window]
    .flatMap((value) => {
      if (!isRecord(value) || typeof value.limit_window_seconds !== "number") return []

      const id: UsageWindow["id"] | undefined =
        value.limit_window_seconds === 18_000
          ? "five_hour"
          : value.limit_window_seconds === 604_800
            ? "week"
            : undefined
      if (!id || typeof value.used_percent !== "number" || !Number.isFinite(value.used_percent)) {
        return []
      }

      const resetAt =
        typeof value.reset_at === "number" && Number.isFinite(value.reset_at) && value.reset_at > 0
          ? value.reset_at * 1000
          : typeof value.reset_after_seconds === "number" &&
              Number.isFinite(value.reset_after_seconds) &&
              value.reset_after_seconds > 0
            ? now + value.reset_after_seconds * 1000
            : null

      return [
        {
          id,
          percentRemaining: Math.max(0, Math.min(100, 100 - value.used_percent)),
          resetAt,
        },
      ]
    })
    .sort((left, right) => WINDOW_MS[left.id] - WINDOW_MS[right.id])
}

function parseRetryAfter(value: string | null) {
  if (!value) return 0
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
