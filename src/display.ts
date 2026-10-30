import type { UsageSnapshot, UsageWindow } from "./rpc.js"

export type SegmentRole = "muted" | "success" | "warning" | "error" | "marker" | "track"
type BarTone = Extract<SegmentRole, "success" | "warning" | "error">

export interface Segment {
  text: string
  role: SegmentRole
  background?: BarTone | "track"
}

const windowLength = {
  five_hour: 5 * 60 * 60_000,
  week: 7 * 24 * 60 * 60_000,
}

const layouts = [
  { barWidth: 10, reset: true, shortLabels: false, tight: false },
  { barWidth: 0, reset: true, shortLabels: false, tight: false },
  { barWidth: 0, reset: true, shortLabels: true, tight: false },
  { barWidth: 0, reset: true, shortLabels: true, tight: true },
]
const partialBlocks = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]

export function usageSegments(
  snapshot: UsageSnapshot | undefined,
  now: number,
  room: number
): Segment[] {
  if (!snapshot) return [{ text: "OpenAI usage …", role: "muted" as const }]
  if (snapshot.state !== "ready") {
    const message = room > 0 ? snapshot.message.slice(0, room) : snapshot.message
    return [{ text: message, role: "warning" as const }]
  }

  const candidates = layouts.map((layout) =>
    snapshot.windows.flatMap((window, index) => [
      ...(index > 0 ? [{ text: layout.tight ? "|" : " | ", role: "muted" as const }] : []),
      ...windowSegments(window, now, layout),
    ])
  )
  const suffix = snapshot.stale ? [{ text: " ~", role: "warning" as const }] : []
  const selected =
    room > 0
      ? candidates.find((candidate) => widthOf([...candidate, ...suffix]) <= room)
      : undefined
  const segments = [...(selected ?? candidates.at(-1) ?? []), ...suffix]
  return room > 0 ? fitSegments(segments, room) : segments
}

function windowSegments(
  window: UsageWindow,
  now: number,
  layout: (typeof layouts)[number]
): Segment[] {
  const name = window.id === "five_hour" ? "5h" : "7d"
  const title = layout.shortLabels || window.id === "week" ? name : `OpenAI ${name}`
  const tone =
    window.percentRemaining < 20 ? "error" : window.percentRemaining < 50 ? "warning" : "success"
  const segments: Segment[] = [{ text: title, role: "muted" }]

  if (layout.barWidth > 0) {
    segments.push({ text: " ", role: "muted" }, ...barSegments(window, now, layout.barWidth, tone))
  }

  segments.push({
    text: `${layout.tight ? "" : " "}${Math.round(window.percentRemaining)}%`,
    role: tone,
  })

  const reset = layout.reset && window.resetAt !== null ? resetText(window.resetAt, now) : ""
  if (reset) segments.push({ text: `·${reset}`, role: "muted" })
  return segments
}

function barSegments(window: UsageWindow, now: number, width: number, tone: BarTone): Segment[] {
  const remaining = Math.max(0, Math.min(100, window.percentRemaining))
  const usedUnits = Math.ceil(((100 - remaining) / 100) * width * 8)
  const filledUnits = width * 8 - usedUnits
  const fullCells = Math.floor(filledUnits / 8)
  const partialUnits = filledUnits % 8
  const evenLeft =
    window.resetAt === null ? undefined : ((window.resetAt - now) / windowLength[window.id]) * 100
  const marker =
    evenLeft !== undefined && evenLeft > 0 && evenLeft < 100
      ? Math.max(0, Math.min(width - 1, Math.round((evenLeft / 100) * width)))
      : undefined

  return Array.from({ length: width }, (_, index) => {
    if (index === marker) {
      return {
        text: "┃",
        role: "marker" as const,
        background:
          index < fullCells || (index === fullCells && partialUnits >= 4) ? tone : "track",
      }
    }
    if (index < fullCells) return { text: "█", role: tone }
    if (index === fullCells && partialUnits > 0) {
      return {
        text: partialBlocks[partialUnits],
        role: tone,
        background: "track" as const,
      }
    }
    return { text: "█", role: "track" as const }
  })
}

function resetText(resetAt: number, now: number) {
  const seconds = Math.max(0, Math.ceil((resetAt - now) / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 60 * 60) return `${Math.ceil(seconds / 60)}m`

  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d${hours % 24 ? `${hours % 24}h` : ""}`
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h${minutes ? `${minutes}m` : ""}`
}

function widthOf(segments: Segment[]) {
  return segments.reduce((width, segment) => width + segment.text.length, 0)
}

function fitSegments(segments: Segment[], room: number) {
  let remaining = room
  return segments.flatMap((segment) => {
    if (remaining <= 0) return []
    const text = segment.text.slice(0, remaining)
    remaining -= text.length
    return text ? [{ ...segment, text }] : []
  })
}
