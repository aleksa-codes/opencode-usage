// @bun
// src/tui.tsx
import { effect as _$effect } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";
import { For, createSignal, onCleanup } from "solid-js";

// src/display.ts
var windowLength = {
  five_hour: 5 * 60 * 60000,
  week: 7 * 24 * 60 * 60000
};
var layouts = [
  { barWidth: 10, reset: true, shortLabels: false, tight: false },
  { barWidth: 0, reset: true, shortLabels: false, tight: false },
  { barWidth: 0, reset: true, shortLabels: true, tight: false },
  { barWidth: 0, reset: true, shortLabels: true, tight: true }
];
var partialBlocks = ["", "\u258F", "\u258E", "\u258D", "\u258C", "\u258B", "\u258A", "\u2589"];
function usageSegments(snapshot, now, room) {
  if (!snapshot)
    return [{ text: "OpenAI usage \u2026", role: "muted" }];
  if (snapshot.state !== "ready") {
    const message = room > 0 ? snapshot.message.slice(0, room) : snapshot.message;
    return [{ text: message, role: "warning" }];
  }
  const candidates = layouts.map((layout) => snapshot.windows.flatMap((window, index) => [
    ...index > 0 ? [{ text: layout.tight ? "|" : " | ", role: "muted" }] : [],
    ...windowSegments(window, now, layout)
  ]));
  const suffix = snapshot.stale ? [{ text: " ~", role: "warning" }] : [];
  const selected = room > 0 ? candidates.find((candidate) => widthOf([...candidate, ...suffix]) <= room) : undefined;
  const segments = [...selected ?? candidates.at(-1) ?? [], ...suffix];
  return room > 0 ? fitSegments(segments, room) : segments;
}
function windowSegments(window, now, layout) {
  const name = window.id === "five_hour" ? "5h" : "7d";
  const title = layout.shortLabels || window.id === "week" ? name : `OpenAI ${name}`;
  const tone = window.percentRemaining < 20 ? "error" : window.percentRemaining < 50 ? "warning" : "success";
  const segments = [{ text: title, role: "muted" }];
  if (layout.barWidth > 0) {
    segments.push({ text: " ", role: "muted" }, ...barSegments(window, now, layout.barWidth, tone));
  }
  segments.push({
    text: `${layout.tight ? "" : " "}${Math.round(window.percentRemaining)}%`,
    role: tone
  });
  const reset = layout.reset && window.resetAt !== null ? resetText(window.resetAt, now) : "";
  if (reset)
    segments.push({ text: `\xB7${reset}`, role: "muted" });
  return segments;
}
function barSegments(window, now, width, tone) {
  const remaining = Math.max(0, Math.min(100, window.percentRemaining));
  const usedUnits = Math.ceil((100 - remaining) / 100 * width * 8);
  const filledUnits = width * 8 - usedUnits;
  const fullCells = Math.floor(filledUnits / 8);
  const partialUnits = filledUnits % 8;
  const evenLeft = window.resetAt === null ? undefined : (window.resetAt - now) / windowLength[window.id] * 100;
  const marker = evenLeft !== undefined && evenLeft > 0 && evenLeft < 100 ? Math.max(0, Math.min(width - 1, Math.round(evenLeft / 100 * width))) : undefined;
  return Array.from({ length: width }, (_, index) => {
    if (index === marker) {
      return {
        text: "\u2503",
        role: "marker",
        background: index < fullCells || index === fullCells && partialUnits >= 4 ? tone : "track"
      };
    }
    if (index < fullCells)
      return { text: "\u2588", role: tone };
    if (index === fullCells && partialUnits > 0) {
      return {
        text: partialBlocks[partialUnits],
        role: tone,
        background: "track"
      };
    }
    return { text: "\u2588", role: "track" };
  });
}
function resetText(resetAt, now) {
  const seconds = Math.max(0, Math.ceil((resetAt - now) / 1000));
  if (seconds < 60)
    return `${seconds}s`;
  if (seconds < 60 * 60)
    return `${Math.ceil(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0)
    return `${days}d${hours % 24 ? `${hours % 24}h` : ""}`;
  const minutes = Math.floor(seconds % 3600 / 60);
  return `${hours}h${minutes ? `${minutes}m` : ""}`;
}
function widthOf(segments) {
  return segments.reduce((width, segment) => width + segment.text.length, 0);
}
function fitSegments(segments, room) {
  let remaining = room;
  return segments.flatMap((segment) => {
    if (remaining <= 0)
      return [];
    const text = segment.text.slice(0, remaining);
    remaining -= text.length;
    return text ? [{ ...segment, text }] : [];
  });
}

// src/rpc.ts
import { Rpc } from "@opencode/plugin/rpc";
var REFRESH_COOLDOWN_MS = 30000;
var UsageRpc = Rpc.define({
  id: "opencode-usage",
  methods: {
    snapshot: {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false
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
                resetAt: { type: ["number", "null"] }
              },
              required: ["id", "percentRemaining", "resetAt"],
              additionalProperties: false
            }
          },
          checkedAt: { type: ["number", "null"] },
          stale: { type: "boolean" },
          message: { type: "string" }
        },
        required: ["state", "windows", "checkedAt", "stale", "message"],
        additionalProperties: false
      }
    }
  },
  events: {}
});
function isUsageSnapshot(value) {
  if (!isRecord(value))
    return false;
  if (value.state !== "ready" && value.state !== "missing" && value.state !== "error")
    return false;
  if (!Array.isArray(value.windows) || typeof value.stale !== "boolean")
    return false;
  if (typeof value.message !== "string")
    return false;
  if (value.checkedAt !== null && !isFiniteNumber(value.checkedAt))
    return false;
  return value.windows.every((window) => isRecord(window) && (window.id === "five_hour" || window.id === "week") && isFiniteNumber(window.percentRemaining) && window.percentRemaining >= 0 && window.percentRemaining <= 100 && (window.resetAt === null || isFiniteNumber(window.resetAt)));
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// src/tui.tsx
var tui_default = Plugin.define({
  id: "opencode-usage.tui",
  setup(context) {
    return context.ui.slot({
      append: "prompt.footer",
      render: (input) => input.sessionID ? _$createComponent(QuotaLine, {
        get sessionID() {
          return input.sessionID;
        }
      }) : null
    });
    function QuotaLine(props) {
      const [snapshot, setSnapshot] = createSignal();
      const [room, setRoom] = createSignal(0);
      const [now, setNow] = createSignal(Date.now());
      let pending = false;
      let disposed = false;
      let refreshAfter = 0;
      let refreshTimer;
      const refresh = async () => {
        if (pending)
          return;
        pending = true;
        try {
          const result = await context.client.rpc(UsageRpc).snapshot({});
          if (!isUsageSnapshot(result))
            throw new Error("Invalid usage snapshot");
          if (!disposed) {
            setSnapshot(result);
            setNow(Date.now());
          }
        } catch (error) {
          if (!disposed && snapshot()?.state === "ready") {
            setSnapshot((previous) => previous ? {
              ...previous,
              stale: true
            } : previous);
          } else if (!disposed && !snapshot()) {
            setSnapshot({
              state: "error",
              windows: [],
              checkedAt: null,
              stale: false,
              message: "OpenAI usage unavailable"
            });
          }
        } finally {
          pending = false;
          if (!disposed && refreshAfter > 0) {
            const value = snapshot();
            clearTimeout(refreshTimer);
            if (value?.state === "ready" && !value.stale && value.checkedAt !== null && value.checkedAt < refreshAfter) {
              refreshTimer = setTimeout(() => void refresh(), Math.max(2000, value.checkedAt + REFRESH_COOLDOWN_MS + 100 - Date.now()));
            } else {
              refreshAfter = 0;
            }
          }
        }
      };
      refresh();
      const refreshAfterExecution = (event) => {
        if (event.data.sessionID !== props.sessionID)
          return;
        refreshAfter = Date.now();
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => void refresh(), 2000);
      };
      const stopEvents = [context.data.on("session.execution.succeeded", refreshAfterExecution), context.data.on("session.execution.failed", refreshAfterExecution), context.data.on("session.execution.interrupted", refreshAfterExecution)];
      const timer = setInterval(() => {
        setNow(Date.now());
        refresh();
      }, 60000);
      onCleanup(() => {
        disposed = true;
        clearInterval(timer);
        clearTimeout(refreshTimer);
        stopEvents.forEach((stop) => stop());
      });
      const theme = context.theme;
      const color = (role) => {
        if (role === "success")
          return theme.text.feedback.success.base;
        if (role === "warning")
          return theme.text.feedback.warning.base;
        if (role === "error")
          return theme.text.feedback.error.base;
        if (role === "marker")
          return theme.background.base;
        if (role === "track")
          return theme.text.muted;
        return theme.text.muted;
      };
      const segments = () => usageSegments(snapshot(), now(), room());
      return (() => {
        var _el$ = _$createElement("box"), _el$2 = _$createElement("text");
        _$insertNode(_el$, _el$2);
        _$setProp(_el$, "flexDirection", "row");
        _$setProp(_el$, "justifyContent", "flex-end");
        _$setProp(_el$, "flexGrow", 1000);
        _$setProp(_el$, "flexShrink", 1);
        _$setProp(_el$, "flexBasis", 0);
        _$setProp(_el$, "minWidth", 0);
        _$setProp(_el$, "overflow", "hidden");
        _$setProp(_el$, "onSizeChange", function() {
          const width = Math.max(0, this.width - 1);
          queueMicrotask(() => setRoom(width));
        });
        _$setProp(_el$2, "wrapMode", "none");
        _$setProp(_el$2, "selectable", false);
        _$setProp(_el$2, "flexShrink", 0);
        _$insert(_el$2, _$createComponent(For, {
          get each() {
            return segments();
          },
          children: (segment) => (() => {
            var _el$3 = _$createElement("span");
            _$insert(_el$3, () => segment.text);
            _$effect((_$p) => _$setProp(_el$3, "style", {
              fg: color(segment.role),
              ...segment.background ? {
                bg: segment.background === "track" ? theme.text.muted : color(segment.background)
              } : {}
            }, _$p));
            return _el$3;
          })()
        }));
        return _el$;
      })();
    }
  }
});
export {
  tui_default as default
};
