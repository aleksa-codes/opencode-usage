import { Rpc } from "@opencode/plugin/rpc"

export const REFRESH_COOLDOWN_MS = 30_000

export interface UsageWindow {
  id: "five_hour" | "week"
  percentRemaining: number
  resetAt: number | null
}

export interface UsageSnapshot {
  state: "ready" | "missing" | "error"
  windows: UsageWindow[]
  checkedAt: number | null
  stale: boolean
  message: string
}

export const UsageRpc = Rpc.define({
  id: "opencode-usage",
  methods: {
    snapshot: {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          state: { type: "string", enum: ["ready", "missing", "error"] },
          windows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", enum: ["five_hour", "week"] },
                percentRemaining: { type: "number", minimum: 0, maximum: 100 },
                resetAt: { type: ["number", "null"] },
              },
              required: ["id", "percentRemaining", "resetAt"],
              additionalProperties: false,
            },
          },
          checkedAt: { type: ["number", "null"] },
          stale: { type: "boolean" },
          message: { type: "string" },
        },
        required: ["state", "windows", "checkedAt", "stale", "message"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})

export function isUsageSnapshot(value: unknown): value is UsageSnapshot {
  if (!isRecord(value)) return false
  if (value.state !== "ready" && value.state !== "missing" && value.state !== "error") return false
  if (!Array.isArray(value.windows) || typeof value.stale !== "boolean") return false
  if (typeof value.message !== "string") return false
  if (value.checkedAt !== null && !isFiniteNumber(value.checkedAt)) return false

  return value.windows.every(
    (window) =>
      isRecord(window) &&
      (window.id === "five_hour" || window.id === "week") &&
      isFiniteNumber(window.percentRemaining) &&
      window.percentRemaining >= 0 &&
      window.percentRemaining <= 100 &&
      (window.resetAt === null || isFiniteNumber(window.resetAt))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}
