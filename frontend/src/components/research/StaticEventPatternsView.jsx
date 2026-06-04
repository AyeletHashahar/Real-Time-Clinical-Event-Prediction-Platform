// src/research/StaticEventPatternsView.jsx
import React, { useEffect, useState } from "react";
import StaticPatternIntervals from "./StaticPatternIntervals";
import DataManagementService from "../dataService/DataManagementService";

/**
 * Shows the list of detected patterns for a given event.
 * Header format: "<event-name> patterns - <event_prob%>"
 * CHANGE: The "Investigate at" slider can be fully controlled via props (timeSec/onChangeTime)
 * so the chosen timestamp persists when navigating Focus <-> back.
 */
export default function StaticEventPatternsView({
  eventIndex = 0,
  onOpenFocus,
  endTime,                       // static max (seconds)
  timeSec: controlledTimeSec,    // OPTIONAL controlled value (if provided)
  onChangeTime,                  // OPTIONAL controlled updater
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patternIndices, setPatternIndices] = useState([]);

  // Header states
  const [eventName, setEventName] = useState(`Event ${eventIndex}`);
  const [eventProb, setEventProb] = useState(0); // 0..1

  // If parent supplies timeSec  onChangeTime => controlled mode; otherwise fallback to local state.
  const isControlled = Number.isFinite(controlledTimeSec);
  const sliderMax = Math.max(0, Number(endTime ?? 0) - 1);
  const [innerTimeSec, setInnerTimeSec] = useState(sliderMax);

  // keep local default in sync (uncontrolled)
  useEffect(() => {
    if (!isControlled) setInnerTimeSec(sliderMax);
  }, [sliderMax, isControlled]);

  // clamp in controlled mode so it never exceeds sliderMax
  useEffect(() => {
    if (isControlled && controlledTimeSec > sliderMax) {
      onChangeTime?.(sliderMax);
    }
  }, [isControlled, controlledTimeSec, sliderMax, onChangeTime]);


  const timeSec = isControlled ? Math.max(0, Math.min(Number(controlledTimeSec), sliderMax)) : innerTimeSec;
  const setTimeSec = isControlled ? (v) => onChangeTime?.(v) : setInnerTimeSec;

  // Utility: mm:ss label
  const fmt = (s) => {
    const ss = Math.max(0, Math.floor(Number(s) || 0));
    const mm = String(Math.floor(ss / 60)).padStart(2, "0");
    const s2 = String(ss % 60).padStart(2, "0");
    return `${mm}:${s2}`;
  };

  /* ----------------------- load pattern indices ----------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const { raw } = await DataManagementService.fetchEventPatterns(eventIndex);
        const indices = Object.keys(raw || {})
          .map((k) => Number(k))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b);

        if (!alive) return;
        setPatternIndices(indices);
      } catch (e) {
        console.error("[StaticEventPatternsView] failed to fetch patterns:", e);
        if (!alive) return;
        setError("Failed to load patterns for this event.");
        setPatternIndices([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [eventIndex]);

  /* --------------------------- resolve event name --------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      let name = null;
      try {
        if (typeof DataManagementService.fetchAllEvents === "function") {
          const all = await DataManagementService.fetchAllEvents();
          if (Array.isArray(all)) {
            const match = all.find(e => Number(e.id ?? e.event_id) === Number(eventIndex));
            name = match?.name ?? match?.title ?? match?.event?.name ?? match?.event ?? null;
          }
        }
        if (!name && typeof DataManagementService.fetchEntitiesAndEvents === "function") {
          const { events } = await DataManagementService.fetchEntitiesAndEvents();
          const rec = events?.[String(eventIndex)] ?? events?.[eventIndex];
          if (rec) name = rec.name ?? rec.title ?? String(rec);
        }
      } catch (err) {
        console.warn("[StaticEventPatternsView] could not resolve event name:", err);
      }
      if (alive) setEventName(name ? String(name) : `Event ${eventIndex}`);
    })();
    return () => { alive = false; };
  }, [eventIndex]);

  /* ----------------------- fetch event probability (0..1) ------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await DataManagementService.fetchEventProbability(eventIndex, timeSec);
        if (alive) setEventProb(Number.isFinite(p) ? p : 0);
      } catch (err) {
        console.error("[StaticEventPatternsView] failed to fetch event prob:", err);
        if (alive) setEventProb(0);
      }
    })();
    return () => { alive = false; };
  }, [eventIndex, timeSec]);

  return (
    <div style={{ padding: 12 }}>
      {/* Header: "<event-name> patterns - <event_prob%>" */}
      <div style={{ fontWeight: 700, margin: "8px 0 8px", fontSize: 16 }}>
        {eventName} patterns - {(eventProb * 100).toFixed(1)}%
      </div>

      {/* Time picker (controlled if props are provided) */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "8px 10px",
        background: "#fff",
        marginBottom: 10
      }}>
        <div style={{fontSize: 12, color: "#374151", minWidth: 90}}>Investigate at</div>
        <input
            type="range"
            min={0}
            max={sliderMax}
            step={1}
            value={timeSec}
            onChange={(e) => setTimeSec(Number(e.target.value))}
            style={{flex: 1}}
        />
        <div style={{width: 54, textAlign: "right", fontSize: 12, color: "#374151"}}>
           {fmt(timeSec)}
        </div>
      </div>

      {loading && (
          <div style={{
            border: "1px dashed #e5e7eb",
            borderRadius: 6,
            padding: 12,
          color: "#6b7280",
          background: "#fafafa",
          marginBottom: 10,
        }}>
          Loading patterns…
        </div>
      )}

      {!!error && (
        <div style={{
          border: "1px solid #fee2e2",
          borderRadius: 6,
          padding: 12,
          color: "#991b1b",
          background: "#fef2f2",
          marginBottom: 10,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && patternIndices.length === 0 && (
        <div style={{
          border: "1px dashed #e5e7eb",
          borderRadius: 6,
          padding: 12,
          color: "#6b7280",
          background: "#fafafa",
        }}>
          No patterns for event {eventIndex}.
        </div>
      )}

      {patternIndices.map((idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: "#F7F7F7",
            border: "2px solid #E0E0E0",
            borderRadius: 4,
            marginBottom: 10,
            marginLeft: 2,
            marginRight: 4,
          }}
        >
          <StaticPatternIntervals
            patternIndex={idx}
            eventIndex={eventIndex}
            endTimeSec={timeSec}                  // use chosen time (controlled)
            showFocus
            onFocus={() => onOpenFocus?.({ patternIndex: idx, eventIndex, endTime: timeSec })}
          />
        </div>
      ))}
    </div>
  );
}
