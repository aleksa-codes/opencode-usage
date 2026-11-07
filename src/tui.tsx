/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import type { BoxRenderable } from "@opentui/core"
import { For, createSignal, onCleanup } from "solid-js"
import { usageSegments } from "./display.js"
import { isUsageSnapshot, REFRESH_COOLDOWN_MS, UsageRpc, type UsageSnapshot } from "./rpc.js"

export default Plugin.define({
  id: "opencode-usage.tui",
  setup(context) {
    const stopPrompt = context.ui.slot({
      append: "prompt.footer",
      render: (input) => (input.sessionID ? <QuotaLine sessionID={input.sessionID} /> : null),
    })

    const stopHome = context.ui.slot({
      append: "home.footer.status",
      render: () => <QuotaLine />,
    })

    return () => {
      stopPrompt()
      stopHome()
    }

    function QuotaLine(props: { sessionID?: string }) {
      const [snapshot, setSnapshot] = createSignal<UsageSnapshot>()
      const [room, setRoom] = createSignal(0)
      const [now, setNow] = createSignal(Date.now())
      let pending = false
      let disposed = false
      let refreshAfter = 0
      let refreshTimer: ReturnType<typeof setTimeout> | undefined

      const refresh = async () => {
        if (pending) return
        pending = true
        try {
          const result: unknown = await context.client.rpc(UsageRpc).snapshot({})
          if (!isUsageSnapshot(result)) throw new Error("Invalid usage snapshot")
          if (!disposed) {
            setSnapshot(result)
            setNow(Date.now())
          }
        } catch (error) {
          if (!disposed && snapshot()?.state === "ready") {
            setSnapshot((previous) => (previous ? { ...previous, stale: true } : previous))
          } else if (!disposed && !snapshot()) {
            setSnapshot({
              state: "error",
              windows: [],
              checkedAt: null,
              stale: false,
              message: "OpenAI usage unavailable",
            })
          }
        } finally {
          pending = false
          if (!disposed && refreshAfter > 0) {
            const value = snapshot()
            clearTimeout(refreshTimer)
            if (
              value?.state === "ready" &&
              !value.stale &&
              value.checkedAt !== null &&
              value.checkedAt < refreshAfter
            ) {
              // A reply finished inside the cooldown. Queue its check instead of dropping it.
              refreshTimer = setTimeout(
                () => void refresh(),
                Math.max(1_000, value.checkedAt + REFRESH_COOLDOWN_MS + 100 - Date.now())
              )
            } else {
              refreshAfter = 0
            }
          }
        }
      }

      void refresh()
      const refreshAfterExecution = (event: { data: { sessionID: string } }) => {
        if (event.data.sessionID !== props.sessionID) return
        refreshAfter = Date.now()
        clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => void refresh(), 1_000)
      }
      const stopEvents = [
        context.data.on("session.execution.succeeded", refreshAfterExecution),
        context.data.on("session.execution.failed", refreshAfterExecution),
        context.data.on("session.execution.interrupted", refreshAfterExecution),
      ]
      const timer = setInterval(() => setNow(Date.now()), 60_000)
      const usageTimer = setInterval(() => void refresh(), 5 * 60_000)

      onCleanup(() => {
        disposed = true
        clearInterval(timer)
        clearInterval(usageTimer)
        clearTimeout(refreshTimer)
        stopEvents.forEach((stop) => stop())
      })

      const theme = context.theme
      const color = (role: ReturnType<typeof usageSegments>[number]["role"]) => {
        if (role === "success") return theme.text.feedback.success.base
        if (role === "warning") return theme.text.feedback.warning.base
        if (role === "error") return theme.text.feedback.error.base
        if (role === "marker") return theme.background.base
        if (role === "track") return theme.text.muted
        return theme.text.muted
      }

      const segments = () => usageSegments(snapshot(), now(), room(), props.sessionID !== undefined)

      return (
        <box
          flexDirection="row"
          justifyContent="flex-end"
          flexGrow={1000}
          flexShrink={1}
          flexBasis={0}
          minWidth={0}
          overflow="hidden"
          onSizeChange={function (this: BoxRenderable) {
            const width = Math.max(0, this.width - 1)
            queueMicrotask(() => setRoom(width))
          }}
        >
          <text wrapMode="none" selectable={false} flexShrink={0}>
            <For each={segments()}>
              {(segment) => (
                <span
                  style={{
                    fg: color(segment.role),
                    ...(segment.background
                      ? {
                          bg:
                            segment.background === "track"
                              ? theme.text.muted
                              : color(segment.background),
                        }
                      : {}),
                  }}
                >
                  {segment.text}
                </span>
              )}
            </For>
          </text>
        </box>
      )
    }
  },
})
