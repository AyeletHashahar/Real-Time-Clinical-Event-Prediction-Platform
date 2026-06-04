// src/components/research/StaticPatternIntervals.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts/highstock";
import xrange from "highcharts/modules/xrange";
import { FaRegQuestionCircle } from "react-icons/fa";
import DataManagementService from "../dataService/DataManagementService";
import PatternModal from "@/components/patterns/patternInfo/PatternPopup";

xrange(Highcharts);

/** Colors
 * BASE_INTERVAL_COLOR - the neutral base intervals layer (all states, not highlighted)
 * HIGHLIGHT_COLOR     - the overlay for the selected predictor(s)/instance(s)
 */
const BASE_INTERVAL_COLOR = "#E5E7EB";
const HIGHLIGHT_COLOR = "rgba(103,136,168,0.80)";

/** Build the storage key for highlight persistence across pages/tabs in this session. */
const hlKey = (eventIndex, patternIndex) =>
  `sp_highlight:${eventIndex}:${patternIndex}`;

/** Format seconds -> mm:ss */
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Collect active state_ids by second:
 *  frames: array of "entity_data" rows returned from DataManagementService.fetchEntityDataFromOneEvent
 *  Returns: Map<second, Set<state_id>>
 */
function collectActiveStatesBySecond(frames) {
  const map = new Map();
  if (!Array.isArray(frames)) return map;
  for (const row of frames) {
    for (const key of Object.keys(row)) {
      const cell = row[key];
      if (!cell || typeof cell !== "object") continue;
      const t = Number(cell.time);
      const sid = cell.state_id;
      if (!Number.isFinite(t)) continue;
      const sec = Math.floor(t);
      if (!map.has(sec)) map.set(sec, new Set());
      if (sid != null) map.get(sec).add(sid);
    }
  }
  return map;
}

/** Given a boolean accessor gridActive(sec), produce continuous rectangles per lane. */
function buildRectsForLane(startSec, endSec, y, gridActive) {
  const out = [];
  let openStart = null;
  for (let s = startSec; s <= endSec; s++) {
    const on = !!gridActive(s);
    if (on) {
      if (openStart == null) openStart = s;
    } else if (openStart != null) {
      out.push({ x: openStart * 1000, x2: s * 1000, y, name: "" });
      openStart = null;
    }
  }
  if (openStart != null) {
    out.push({
      x: openStart * 1000,
      x2: (endSec + 1) * 1000,
      y,
      name: "",
    });
  }
  return out;
}

/**
 * StaticPatternIntervals
 * - Renders the central pattern intervals (xrange) for a single pattern index.
 * - Base layer shows all active states (neutral gray).
 * - Highlight layer overlays selected predictor(s)/instance(s) from detection_tirps.
 * - The highlight selection is PERSISTED in sessionStorage so it survives navigation
 *   between the patterns list and focus page (and back).
 *
 * Props:
 * - patternIndex: number
 * - eventIndex: number
 * - endTimeSec: number (the chosen "investigate at" time; graph covers [0..endTimeSec])
 * - initialWindowSec?: number (fallback if endTimeSec is undefined)
 * - showFocus?: boolean (show/hide the Focus button; on focus page it's false)
 * - onFocus?: () => void (open the focus page)
 * - onSelectInstances?: (instances|null) => void
 *      When highlight selection changes, we bubble up the chosen instances (if any),
 *      so the variable graphs can mirror the highlight.
 */
export default function StaticPatternIntervals({
  patternIndex = 0,
  eventIndex = 0,
  title = null,
  onFocus = () => {},
  showFocus = true,
  endTimeSec,
  initialWindowSec = 50,
  onSelectInstances = () => {},
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  const [patternData, setPatternData] = useState(null); // [stateIds[], labels[]]
  const [patternProb, setPatternProb] = useState(0);

  // highlight dropdown options + selection (persisted in sessionStorage)
  const [highlightOptions, setHighlightOptions] = useState([
    { value: "none", label: "No Highlights" },
  ]);
  const [highlightSelection, setHighlightSelection] = useState("none");
  const [highlightDisabled, setHighlightDisabled] = useState(true);

  // Predictor instances (detection_tirps) for the current timestamp
  const [detectedRows, setDetectedRows] = useState([]);

  // Clamp window to 0..endSec
  const endSec = useMemo(
    () => Math.max(0, Math.floor(Number(endTimeSec ?? initialWindowSec))),
    [endTimeSec, initialWindowSec]
  );
  const endMs = endSec * 1000;

  /* 1) Load pattern metadata (stateIds + labels) used to construct the Y lanes */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const patterns = await DataManagementService.fetchAllPatterns(eventIndex);
        const found = Array.isArray(patterns)
          ? patterns.find((p) => p?.index === patternIndex)?.patternData
          : null;
        if (!alive) return;
        setPatternData(Array.isArray(found) ? found : null);
      } catch (err) {
        console.error("[StaticPatternIntervals] fetchAllPatterns failed:", err);
        if (alive) setPatternData(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [patternIndex, eventIndex]);

  /* 2) Build & mount the Highcharts XRange chart */
  useEffect(() => {
    if (!containerRef.current) return;

    let stateIds = [];
    let categories = [];
    if (Array.isArray(patternData)) {
      stateIds = Array.isArray(patternData[0]) ? patternData[0] : [];
      categories = Array.isArray(patternData[1]) ? patternData[1] : [];
    }
    if (!categories.length && stateIds.length) categories = stateIds.map(String);
    if (!categories.length) {
      categories = [""];
      stateIds = [0];
    }
    const yMax = Math.max(0, categories.length - 1);

    if (chartRef.current) {
      try {
        chartRef.current.destroy();
      } catch {}
      chartRef.current = null;
    }

    const chart = Highcharts.stockChart(containerRef.current, {
      chart: {
        type: "xrange",
        height: 230,
        backgroundColor: "#FFFFFF",
        marginLeft: 100,
        marginRight: 30,
        spacingTop: 6,
        spacingRight: 8,
        spacingBottom: 8,
        spacingLeft: 8,
        events: {
          load: function () {
            const c = this;
            const placeButtons = () => {
              const w = c.chartWidth;
              if (!c.customButtons) c.customButtons = {};
              if (!c.customButtons.nowBtn) {
                c.customButtons.nowBtn = c.renderer
                  .button("Now", w - 75, 10, function () {
                    const xMax = endMs;
                    const xMin = Math.max(0, xMax - 30000);
                    c.xAxis[0].setExtremes(xMin, xMax, true, true);
                  })
                  .attr({ zIndex: 3, height: 6 })
                  .add();
              } else {
                c.customButtons.nowBtn.attr({ x: w - 75 });
              }
            };
            placeButtons();

            const orig = c.redraw.bind(c);
            c.redraw = function () {
              orig();
              placeButtons();
            };
            const onResize = () => {
              c.reflow();
              placeButtons();
            };
            window.addEventListener("resize", onResize);
            Highcharts.addEvent(c, "destroy", () =>
              window.removeEventListener("resize", onResize)
            );
          },
        },
      },

      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },

      rangeSelector: {
        enabled: true,
        selected: 2,
        buttons: [
          { type: "second", count: 30, text: "30s" },
          { type: "minute", count: 1, text: "1m" },
          { type: "all", text: "All" },
        ],
        inputEnabled: false,
        buttonTheme: {
          r: 4,
          style: { fontSize: "11px" },
          states: { select: { fill: "#6787A8", style: { color: "#fff" } } },
        },
      },

      navigator: { enabled: false },
      scrollbar: { enabled: true },

      xAxis: {
        type: "datetime",
        ordinal: false, // keep real time spacing
        tickInterval: 1000,
        min: 0,
        max: endMs,
        labels: {
          formatter() {
            const s = Math.round(this.value / 1000);
            const mm = String(Math.floor(s / 60)).padStart(2, "0");
            const ss = String(s % 60).padStart(2, "0");
            return `${mm}:${ss}`;
          },
          style: { fontSize: "12px" },
        },
        gridLineWidth: 0,
      },

      yAxis: [
        {
          title: { text: "" },
          categories,
          reversed: true,
          opposite: false,
          labels: { align: "right", x: -10, style: { fontSize: "12px" } },
          lineWidth: 1,
          gridLineColor: "rgba(0,0,0,0.08)",
          min: 0,
          max: yMax,
          tickInterval: 1,
        },
      ],

      tooltip: { enabled: false },

      plotOptions: {
        series: {
          animation: false,
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
        },
        xrange: { grouping: false, animation: false },
      },

      series: [
        // Invisible baseline to stabilize axes extents
        {
          name: "_baseline",
          type: "xrange",
          showInLegend: false,
          enableMouseTracking: false,
          colorByPoint: false,
          data: [
            { x: 0, x2: 1000, y: 0, color: "rgba(0,0,0,0)" },
            {
              x: Math.max(0, endMs - 1000),
              x2: endMs,
              y: yMax,
              color: "rgba(0,0,0,0)",
            },
          ],
          pointWidth: 1,
          states: { inactive: { opacity: 1 } },
        },
        // Base intervals layer (neutral)
        {
          name: "Intervals",
          type: "xrange",
          data: [],
          color: BASE_INTERVAL_COLOR,
          colorByPoint: false,
          pointWidth: 16,
          borderRadius: 0,
          enableMouseTracking: false,
          zIndex: 1,
        },
        // Highlight overlay (selected predictors/instances)
        {
          name: "Highlights",
          type: "xrange",
          data: [],
          color: HIGHLIGHT_COLOR,
          colorByPoint: false,
          pointWidth: 16,
          borderRadius: 0,
          enableMouseTracking: false,
          zIndex: 2,
        },
      ],
    });

    try {
      chart.xAxis[0].setExtremes(0, endMs, true, false);
    } catch {}
    try {
      chart.yAxis[0].setExtremes(0, yMax, true, false);
    } catch {}

    chartRef.current = chart;
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.destroy();
        } catch {}
        chartRef.current = null;
      }
    };
  }, [patternData, endMs]);

  /* 3) Populate the base intervals [0..endSec] by reading historical frames */
  useEffect(() => {
    let alive = true;
    const c = chartRef.current;
    if (!c) return;

    (async () => {
      try {
        const frames = await DataManagementService.fetchEntityDataFromOneEvent({
          eventId: eventIndex,
          endTime: endSec,
        });
        const act = collectActiveStatesBySecond(frames);

        let stateIds = [];
        let categories = [];
        if (Array.isArray(patternData)) {
          stateIds = Array.isArray(patternData[0]) ? patternData[0] : [];
          categories = Array.isArray(patternData[1]) ? patternData[1] : [];
        }
        if (!categories.length && stateIds.length) categories = stateIds.map(String);

        const rects = [];
        for (let i = 0; i < stateIds.length; i++) {
          const sid = stateIds[i];
          const y = i;
          const isOn = (sec) => act.get(sec)?.has(sid) ?? false;
          rects.push(...buildRectsForLane(0, endSec, y, isOn));
        }

        if (!alive) return;
        const base = c.series?.find((s) => s.name === "Intervals");
        if (base) base.setData(rects, false);
        try {
          c.redraw();
        } catch {}
      } catch (e) {
        console.error("[StaticPatternIntervals] populate intervals failed:", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [patternData, eventIndex, endSec]);

  /* 4) Pattern probability (right side header) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await DataManagementService.fetchPatternProbability(
          eventIndex,
          endSec,
          patternIndex
        );
        if (!alive) return;
        setPatternProb(Number.isFinite(p) ? p : 0);
      } catch (err) {
        console.error("[StaticPatternIntervals] fetch probability failed:", err);
        if (alive) setPatternProb(0);
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventIndex, endSec, patternIndex]);

  /* 5) Build highlight menu from detection_tirps, restore/save selection in sessionStorage */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const payload = await DataManagementService.fetchDetectedPatternsAndProb(
          eventIndex,
          endSec
        );
        const rows = Array.isArray(payload?.detected_patters)
          ? payload.detected_patters
          : [];

        // pick exact endSec row or last <= endSec
        let row = rows.find((r) => Number(r?.timestamp) === endSec);
        if (!row)
          for (let i = rows.length - 1; i >= 0 && !row; i--) {
            if (Number(rows[i]?.timestamp) <= endSec) row = rows[i];
          }

        const tirpsMap =
          row?.detection_tirps ??
          row?.detected_tirps ??
          row?.detectionTirps ??
          null;

        const list = Array.isArray(tirpsMap?.[String(patternIndex)])
          ? tirpsMap[String(patternIndex)]
          : [];

        // Build options: none | all | per-instance ("Predictor mm:ss")
        const instMenu = list.map((inst, i) => {
          const seq = Array.isArray(inst?.[0]) ? inst[0] : [];
          const start = Number(seq?.[0]?.[2]); // first event's start time
          return {
            index: i,
            startSec: Number.isFinite(start) ? Math.round(start) : null,
          };
        });

        if (!alive) return;
        setDetectedRows(list);

        const opts = [
          { value: "none", label: "No Highlights" },
          { value: "all", label: "All Predictors" },
          ...instMenu.map(({ index, startSec }) => ({
            value: `inst-${index}`,
            label: `Predictor ${startSec != null ? fmtTime(startSec) : "—"}`,
          })),
        ];
        setHighlightOptions(opts);
        setHighlightDisabled(instMenu.length === 0);

        // Restore selection from sessionStorage (if valid)
        let restored = null;
        try {
          restored =
            typeof window !== "undefined"
              ? window.sessionStorage.getItem(hlKey(eventIndex, patternIndex))
              : null;
        } catch {}

        const isValid =
          restored === "none" ||
          restored === "all" ||
          (/^inst-\d+$/.test(restored || "") &&
            instMenu[Number((restored || "").split("-")[1])] != null);

        setHighlightSelection((sel) => {
          if (isValid) return restored;
          // keep current if still valid under the new list
          const cur = sel;
          const curValid =
            cur === "none" ||
            cur === "all" ||
            (/^inst-\d+$/.test(cur) &&
              instMenu[Number(cur.split("-")[1])] != null);
          return curValid ? cur : "none";
        });
      } catch (err) {
        console.error(
          "[StaticPatternIntervals] fetch detection_tirps failed:",
          err
        );
        setDetectedRows([]);
        setHighlightOptions([{ value: "none", label: "No Highlights" }]);
        setHighlightSelection("none");
        setHighlightDisabled(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventIndex, endSec, patternIndex]);

  // Persist any selection change to sessionStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          hlKey(eventIndex, patternIndex),
          String(highlightSelection)
        );
      }
    } catch {}
  }, [highlightSelection, eventIndex, patternIndex]);

  /* 6) Apply highlight overlay and bubble selected instances up to parent */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !Array.isArray(patternData)) {
      onSelectInstances(null);
      return;
    }

    const [stateIds, categories] = patternData;
    const stateIdToY = new Map(stateIds.map((sid, i) => [sid, i]));
    const series = chart.series?.find((s) => s.name === "Highlights");
    if (!series) {
      onSelectInstances(null);
      return;
    }

    // Convert a single instance to xrange rects for the overlay
    const rectsFromInstance = (instance) => {
      const events = Array.isArray(instance?.[0]) ? instance[0] : [];
      const open = new Map(); // sid -> [startMs,...]
      const rects = [];

      for (const ev of events) {
        if (!Array.isArray(ev) || ev.length < 3) continue;
        const [type, stateId, t] = ev;
        if (!stateIdToY.has(stateId)) continue;
        const tMs = Number(t) * 1000;
        if (type === "+") {
          if (!open.has(stateId)) open.set(stateId, []);
          open.get(stateId).push(tMs);
        } else if (type === "-") {
          const starts = open.get(stateId);
          if (starts && starts.length) {
            const sMs = starts.shift();
            rects.push({
              x: sMs,
              x2: tMs,
              y: stateIdToY.get(stateId),
              name: categories[stateIdToY.get(stateId)],
              color: HIGHLIGHT_COLOR,
            });
          }
        }
      }

      // Close any opens at the current window end
      for (const [sid, starts] of open.entries()) {
        const y = stateIdToY.get(sid);
        if (y == null) continue;
        for (const sMs of starts) {
          rects.push({
            x: sMs,
            x2: (endSec + 1) * 1000,
            y,
            name: categories[y],
            color: HIGHLIGHT_COLOR,
          });
        }
      }
      return rects;
    };

    let rects = [];
    let chosenInstances = null;

    if (highlightSelection === "none") {
      rects = [];
      chosenInstances = null;
    } else if (highlightSelection === "all") {
      chosenInstances = detectedRows.slice();
      for (const inst of detectedRows) rects.push(...rectsFromInstance(inst));
    } else if (/^inst-\d+$/.test(highlightSelection)) {
      const idx = Number(highlightSelection.split("-")[1]);
      const inst = detectedRows[idx];
      if (inst) {
        chosenInstances = [inst];
        rects = rectsFromInstance(inst);
      }
    }

    series.setData(rects, true);
    onSelectInstances(chosenInstances);
  }, [highlightSelection, detectedRows, patternData, endSec, onSelectInstances]);

  return (
    <div style={{ padding: 8 }}>
      {/* Header row: title + info + highlight selector + optional Focus + probability */}
      <div
        style={{
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            {title ?? `Pattern ${patternIndex}`}
          </h3>
          <PatternModal
            patternId={patternIndex}
            eventId={eventIndex}
            triggerLabel={
              <FaRegQuestionCircle className="w-4 h-4 text-blue-600 hover:text-blue-800" />
            }
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ marginRight: 6 }}>Highlight Predictor:</label>
          <select
            value={highlightSelection}
            onChange={(e) => setHighlightSelection(e.target.value)}
            disabled={highlightDisabled}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              minWidth: 170,
              background: highlightDisabled ? "#F3F4F6" : "#FFFFFF",
            }}
          >
            {highlightOptions.map((opt) => (
              <option key={`${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {showFocus && (
            <button
              onClick={onFocus}
              style={{
                border: "1px solid #60a5fa",
                background: "#fff",
                color: "#1d4ed8",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
              }}
            >
              Focus
            </button>
          )}
        </div>

        <div
          style={{
            fontWeight: "bold",
            fontSize: 16,
            minWidth: 200,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <span>Pattern Probability :</span>
          <span style={{ width: 60, textAlign: "right" }}>
            {(patternProb * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          height: 230,
          width: "100%",
          border: "2px solid #E0E0E0",
          borderRadius: 4,
        }}
      />
    </div>
  );
}
