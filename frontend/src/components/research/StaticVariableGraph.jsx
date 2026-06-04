// src/research/StaticVariableGraph.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import Highcharts from "highcharts/highstock";
import xrange from "highcharts/modules/xrange";
import DataManagementService from "../dataService/DataManagementService";
import { formatXAxisLabel } from "../../utils/xAxisFormatter";

xrange(Highcharts);

// Colors
const BASE_INTERVAL_COLOR = "#E9EEF6";                 // base intervals (variable graphs)
const HIGHLIGHT_COLOR     = "rgba(103,136,168,0.80)";  // highlight color
const RAW_POINTS_COLOR    = "#C9D8F2";

/* ------------------------- Helpers (same as before) ----------------------- */
function sanitizeSeries(points) {
  if (!Array.isArray(points)) return [];
  const byTs = new Map();
  for (const p of points) {
    const t = Number(p?.time);
    if (!Number.isFinite(t)) continue;
    const raw = p?.raw_value === "None" ? null : p?.raw_value;
    if (!byTs.has(t)) {
      byTs.set(t, { time: t, raw_value: raw, state_id: p?.state_id ?? null, bin_id: p?.bin_id ?? null });
    } else {
      const prev = byTs.get(t);
      byTs.set(t, {
        time: t,
        raw_value: prev.raw_value == null ? raw : prev.raw_value,
        state_id: p?.state_id ?? prev.state_id ?? null,
        bin_id: p?.bin_id ?? prev.bin_id ?? null,
      });
    }
  }
  const arr = Array.from(byTs.values()).sort((a, b) => a.time - b.time);
  if (arr.length === 1) {
    const t = arr[0].time;
    arr.unshift({ time: t - 1, raw_value: null });
    arr.push({ time: t + 1, raw_value: null });
  }
  return arr;
}
function expandToSecondGrid(series, startSec, endSec) {
  const map = new Map(series.map((p) => [Number(p.time), p]));
  const out = [];
  for (let t = startSec; t <= endSec; t += 1) {
    const p = map.get(t);
    if (p) out.push({ time: t, raw_value: p.raw_value, state_id: p.state_id ?? null, bin_id: p.bin_id ?? null });
    else out.push({ time: t, raw_value: null, state_id: null, bin_id: null });
  }
  return out;
}
function ensureAllButtonsSelected(chart, min, max) {
  try { chart.xAxis[0].setExtremes(min, max, false, false); } catch {}
  try {
    const rs = chart.rangeSelector;
    if (rs?.buttonOptions?.length) {
      const allIdx = rs.buttonOptions.findIndex((b) => b.type === "all");
      if (allIdx >= 0 && rs.buttons?.[allIdx]) rs.clickButton(allIdx, rs.buttons[allIdx], true);
    }
  } catch {}
}
function applyCutoffsAndNormalBand(chart, cutoffsRows = [], normalBounds = null) {
  if (!chart?.yAxis?.[0]) return;
  const vals = [];
  cutoffsRows.forEach((r) => {
    const low = Number(r?.BinLow ?? r?.low ?? r?.lo ?? r?.min ?? r?.Min);
    const high = Number(r?.BinHigh ?? r?.high ?? r?.hi ?? r?.max ?? r?.Max);
    if (Number.isFinite(low)) vals.push(low);
    if (Number.isFinite(high)) vals.push(high);
  });
  const eps = 1e-9, uniq = [];
  vals.sort((a,b)=>a-b).forEach((v)=>{ if (!uniq.length || Math.abs(uniq[uniq.length-1]-v)>eps) uniq.push(v); });
  const plotLines = uniq.map((v)=>({ value: v, color: "#9CA3AF", width: 1, dashStyle: "ShortDash", zIndex: 4 }));
  const plotBands = [];
  if (Array.isArray(normalBounds) && normalBounds.length === 2) {
    const [low, high] = normalBounds.map(Number);
    if (Number.isFinite(low) && Number.isFinite(high)) plotBands.push({ from: low, to: high, color: "rgba(144, 238, 144, 0.15)" });
  }
  try { chart.yAxis[0].update({ plotLines, plotBands }, true); } catch {}
}
function buildIntervalsFromGrid(grid, stateIdToY) {
  const out = [];
  if (!Array.isArray(grid) || grid.length === 0) return out;
  let open = null; // { stateId, y, startSec }
  for (let i = 0; i < grid.length; i++) {
    const { time: sec, state_id } = grid[i];
    if (state_id == null || stateIdToY[state_id] === undefined) {
      if (open) { out.push({ x: open.startSec * 1000, x2: sec * 1000, y: open.y, name: "" }); open = null; }
      continue;
    }
    const y = stateIdToY[state_id];
    if (!open) open = { stateId: state_id, y, startSec: sec };
    else if (open.stateId !== state_id) { out.push({ x: open.startSec * 1000, x2: sec * 1000, y: open.y, name: "" }); open = { stateId: state_id, y, startSec: sec }; }
  }
  const lastSec = grid[grid.length - 1].time;
  if (open) out.push({ x: open.startSec * 1000, x2: (lastSec + 1) * 1000, y: open.y, name: "" });
  return out;
}

/* ------------------------------- Component -------------------------------- */
export default function StaticVariableGraph({
  temporalPropertyId,
  eventIndex = 0,
  initialWindowSec = 50,
  endTimeSec,
  titleOverride = null,
  stateLabelsOverride = null,
  // NEW: highlight chosen predictor occurrences from the pattern graph
  highlightInstances = null, // array: [[events[], prob], ...] | null
}) {
  const intervalsRef = useRef(null);
  const rawRef = useRef(null);
  const intervalsChartRef = useRef(null);
  const rawChartRef = useRef(null);

  const [title, setTitle] = useState(titleOverride ?? (temporalPropertyId ? `Property ${temporalPropertyId}` : "Variable"));
  const [states, setStates] = useState([]);          // [{ StateID, BinLabel }]
  const [view, setView] = useState("intervals");     // "intervals" | "raw"

  const [rawPoints, setRawPoints] = useState([]);    // [{ time, raw_value }]
  const [cutoffs, setCutoffs] = useState([]);
  const [normalBounds, setNormalBounds] = useState(null);

  const endSec = Math.max(0, Math.floor(Number(endTimeSec ?? initialWindowSec)));
  const endMs  = endSec * 1000;

  /* -------------------- 1) metadata (or overrides) ------------------------ */
  useEffect(() => {
    let alive = true;

    if (titleOverride || (stateLabelsOverride && stateLabelsOverride.length)) {
      setTitle(titleOverride ?? "Variable");
      const s = (stateLabelsOverride ?? []).map((lbl, i) => ({ StateID: i, BinLabel: String(lbl) }));
      setStates(s);
      return () => { alive = false; };
    }

    (async () => {
      try {
        const [t, s] = await Promise.all([
          temporalPropertyId != null ? DataManagementService.fetchTitle(temporalPropertyId, eventIndex) : Promise.resolve(null),
          temporalPropertyId != null ? DataManagementService.fetchStates(temporalPropertyId, eventIndex) : Promise.resolve([]),
        ]);
        if (!alive) return;
        if (t) setTitle(String(t));
        if (Array.isArray(s)) setStates(s);
      } catch (e) {
        console.error("[StaticVariableGraph] meta load failed:", e);
        if (alive) setStates([]);
      }
    })();

    return () => { alive = false; };
  }, [temporalPropertyId, eventIndex, titleOverride, stateLabelsOverride]);

  /* -------------------- 2) build intervals chart -------------------------- */
  useEffect(() => {
    if (!intervalsRef.current) return;

    const stateMap = (states || []).slice().sort((a, b) => Number(a.StateID) - Number(b.StateID));
    const categories = stateMap.map((s) => s.BinLabel ?? String(s.StateID));
    const yMax = Math.max(0, (categories.length || 1) - 1);

    if (intervalsChartRef.current) {
      try { intervalsChartRef.current.destroy(); } catch {}
      intervalsChartRef.current = null;
    }

    const chart = Highcharts.stockChart(intervalsRef.current, {
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
            const placeNow = () => {
              const w = c.chartWidth;
              if (!c.customButtons) c.customButtons = {};
              if (!c.customButtons.nowBtn) {
                c.customButtons.nowBtn = c.renderer
                  .button("Now", w - 75, 10, function () {
                    const xMax = endMs, xMin = Math.max(0, xMax - 30000);
                    c.xAxis[0].setExtremes(xMin, xMax, true, true);
                  })
                  .attr({ zIndex: 3, height: 6 })
                  .add();
              } else { c.customButtons.nowBtn.attr({ x: w - 75 }); }
            };
            placeNow();
            const orig = c.redraw.bind(c);
            c.redraw = function () { orig(); placeNow(); };
            const onResize = () => { c.reflow(); placeNow(); };
            window.addEventListener("resize", onResize);
            Highcharts.addEvent(c, "destroy", () => window.removeEventListener("resize", onResize));
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
        ordinal: false,
        tickInterval: 1000,
        min: 0,
        max: endMs,
        labels: {
          formatter() {
            return formatXAxisLabel(this.value);
          },
          style: { fontSize: "12px" },
        },
        gridLineWidth: 0,
      },
      yAxis: [{
        title: { text: "" },
        categories: categories.length ? categories : [""],
        reversed: false,
        opposite: false,
        labels: { align: "right", x: -10, style: { fontSize: "12px" } },
        lineWidth: 1,
        min: 0,
        max: yMax,
        tickInterval: 1,
        visible: true,
      }],
      tooltip: { enabled: false },
      plotOptions: {
        series: { animation: false, borderWidth: 0, pointPadding: 0, groupPadding: 0 },
        xrange: { grouping: false, animation: false },
      },
      series: [
        {
          name: "_baseline",
          type: "xrange",
          showInLegend: false,
          enableMouseTracking: false,
          colorByPoint: false,
          data: [
            { x: 0, x2: 1000, y: 0, color: "rgba(0,0,0,0)" },
            { x: Math.max(0, endMs - 1000), x2: endMs, y: yMax, color: "rgba(0,0,0,0)" },
          ],
          pointWidth: 1,
          states: { inactive: { opacity: 1 } },
        },
        { name: "Intervals",  type: "xrange", data: [], color: BASE_INTERVAL_COLOR, colorByPoint: false, pointWidth: 20, borderRadius: 0, enableMouseTracking: false, zIndex: 1 },
        // NEW: highlighted predictor rectangles
        { name: "Highlights", type: "xrange", data: [], color: HIGHLIGHT_COLOR,    colorByPoint: false, pointWidth: 20, borderRadius: 0, enableMouseTracking: false, zIndex: 2 },
      ],
    });

    try { chart.xAxis[0].setExtremes(0, endMs, true, false); } catch {}
    try { chart.yAxis[0].setExtremes(0, yMax, true, false); } catch {}

    intervalsChartRef.current = chart;
  }, [states, endMs]);

  /* -------------------- 3) populate intervals from frames ----------------- */
  useEffect(() => {
    let alive = true;
    if (!intervalsChartRef.current) return;
    if (temporalPropertyId == null) return;

    (async () => {
      try {
        const frames = await DataManagementService.fetchEntityDataFromOneEvent({
          eventId: eventIndex,
          endTime: endSec,
        });

        const propKey = String(temporalPropertyId);
        const series = [];
        for (const row of frames || []) {
          const point = propKey ? row[propKey] : null;
          if (point) series.push({
            time: Number(point?.time) || 0,
            raw_value: point?.raw_value,
            state_id: point?.state_id ?? null,
            bin_id: point?.bin_id ?? null,
          });
        }

        const clean = sanitizeSeries(series);
        const grid = expandToSecondGrid(clean, 0, endSec);

        const stateIdToY = {};
        (states || []).slice().sort((a, b) => Number(a.StateID) - Number(b.StateID))
          .forEach((s, idx) => { stateIdToY[s.StateID] = idx; });

        const rects = buildIntervalsFromGrid(grid, stateIdToY);
        if (!alive) return;

        try {
          const c = intervalsChartRef.current;
          const base = c?.series?.find((s) => s?.name === "Intervals");
          if (base) base.setData(rects, false);
          ensureAllButtonsSelected(c, 0, endMs);
          c?.redraw();
        } catch {}
      } catch (e) {
        console.error("[StaticVariableGraph] intervals populate failed:", e);
      }
    })();

    return () => { alive = false; };
  }, [temporalPropertyId, eventIndex, states, endMs, endTimeSec, initialWindowSec]);

  /* -------------------- 4) highlights from pattern selection -------------- */
  useEffect(() => {
    // Build highlight rects ONLY for state IDs that belong to this variable
    const c = intervalsChartRef.current;
    if (!c) return;

    const stateIdToY = new Map(
      (states || []).slice().sort((a, b) => Number(a.StateID) - Number(b.StateID))
      .map((s, idx) => [Number(s.StateID), idx])
    );

    const series = c.series?.find((s) => s.name === "Highlights");
    if (!series) return;

    const instances = Array.isArray(highlightInstances) ? highlightInstances : null;
    if (!instances || instances.length === 0) {
      series.setData([], true);
      return;
    }

    const rects = [];
    const buildFromInstance = (inst) => {
      const events = Array.isArray(inst?.[0]) ? inst[0] : [];
      const open = new Map(); // sid -> [startMs,...]
      for (const ev of events) {
        if (!Array.isArray(ev) || ev.length < 3) continue;
        const [type, stateId, t] = ev;
        if (!stateIdToY.has(Number(stateId))) continue; // ignore states that don't belong to this variable
        const tMs = Number(t) * 1000;
        if (type === "+") {
          if (!open.has(stateId)) open.set(stateId, []);
          open.get(stateId).push(tMs);
        } else if (type === "-") {
          const starts = open.get(stateId);
          if (starts && starts.length) {
            const sMs = starts.shift();
            rects.push({ x: sMs, x2: tMs, y: stateIdToY.get(Number(stateId)), name: "", color: HIGHLIGHT_COLOR });
          }
        }
      }
      for (const [sid, starts] of open.entries()) {
        const y = stateIdToY.get(Number(sid));
        if (y == null) continue;
        for (const sMs of starts) rects.push({ x: sMs, x2: (endSec + 1) * 1000, y, name: "", color: HIGHLIGHT_COLOR });
      }
    };

    for (const inst of instances) buildFromInstance(inst);
    series.setData(rects, true);
  }, [highlightInstances, states, endSec]);

  /* -------------------- 5) RAW view (unchanged aside from color) ---------- */
  useEffect(() => {
    let alive = true;
    if (view !== "raw") return;

    (async () => {
      try {
        const frames = await DataManagementService.fetchEntityDataFromOneEvent({
          eventId: eventIndex,
          endTime: endSec,
        });

        const propKey = String(temporalPropertyId ?? "");
        const raw = [];
        for (const row of frames || []) {
          const point = propKey ? row[propKey] : null;
          if (point) raw.push({
            time: Number(point?.time) || 0,
            raw_value: point?.raw_value,
            state_id: point?.state_id ?? null,
            bin_id: point?.bin_id ?? null,
          });
        }

        const clean = sanitizeSeries(raw);
        const grid = expandToSecondGrid(clean, 0, endSec);
        if (!alive) return;
        setRawPoints(grid);

        const [boundsAll, cutRows] = await Promise.all([
          DataManagementService.fetchAllNormalBounds(),
          temporalPropertyId ? DataManagementService.fetchTemporalPropertyCutoffs(temporalPropertyId, eventIndex) : Promise.resolve([]),
        ]);
        if (!alive) return;
        const nb = boundsAll?.[String(temporalPropertyId)] ?? null;
        setNormalBounds(Array.isArray(nb) && nb.length === 2 ? nb : null);

        const normCuts = Array.isArray(cutRows)
          ? cutRows.map((r) => ({
              BinID: r?.BinID ?? r?.bin_id ?? r?.id ?? null,
              BinLabel: r?.BinLabel ?? r?.label ?? null,
              BinHigh: r?.BinHigh ?? r?.high ?? r?.hi ?? null,
              BinLow:  r?.BinLow  ?? r?.low  ?? r?.lo ?? null,
            }))
          : [];
        setCutoffs(normCuts);
      } catch (e) {
        console.error("[StaticVariableGraph] raw view load failed:", e);
        if (alive) { setRawPoints([]); setCutoffs([]); setNormalBounds(null); }
      }
    })();

    return () => { alive = false; };
  }, [view, temporalPropertyId, eventIndex, endSec]);

  useEffect(() => {
    if (view !== "raw") return;
    if (!rawRef.current) return;

    const data = (rawPoints || []).map((p) =>
      p?.raw_value == null ? [p.time * 1000, null] : [p.time * 1000, Number(p.raw_value)]
    );

    if (!rawChartRef.current) {
      const chart = Highcharts.stockChart(rawRef.current, {
        chart: {
          type: "scatter",
          height: 230,
          backgroundColor: "#FFFFFF",
          marginLeft: 60,
          marginRight: 30,
          spacingTop: 6,
          spacingRight: 8,
          spacingBottom: 8,
          spacingLeft: 8,
          events: {
            load: function () {
              const c = this;
              const placeNow = () => {
                const w = c.chartWidth;
                if (!c.customButtons) c.customButtons = {};
                if (!c.customButtons.nowBtn) {
                  c.customButtons.nowBtn = c.renderer
                    .button("Now", w - 75, 10, function () {
                      const xMax = endMs, xMin = Math.max(0, xMax - 30000);
                      c.xAxis[0].setExtremes(xMin, xMax, true, true);
                    })
                    .attr({ zIndex: 3, height: 6 })
                    .add();
                } else { c.customButtons.nowBtn.attr({ x: w - 75 }); }
              };
              placeNow();
              const orig = c.redraw.bind(c);
              c.redraw = function () { orig(); placeNow(); };
              const onResize = () => { c.reflow(); placeNow(); };
              window.addEventListener("resize", onResize);
              Highcharts.addEvent(c, "destroy", () => window.removeEventListener("resize", onResize));
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
          ordinal: false,
          tickInterval: 1000,
          min: 0,
          max: endMs,
          labels: {
            formatter() {
              return formatXAxisLabel(this.value);
            },
            style: { fontSize: "12px" },
          },
          gridLineWidth: 0,
        },
        yAxis: [{
          title: { text: "" },
          opposite: false,
          labels: { align: "right", x: -10, style: { fontSize: "12px" } },
          lineWidth: 1,
          tickAmount: 5,
        }],
        tooltip: { enabled: false },
        plotOptions: {
          scatter: { marker: { radius: 3 }, turboThreshold: 0 },
          series: { animation: false },
        },
        series: [
          { name: "Raw", color: RAW_POINTS_COLOR, type: "scatter", data },
        ],
      });

      ensureAllButtonsSelected(chart, 0, endMs);
      rawChartRef.current = chart;
      applyCutoffsAndNormalBand(chart, cutoffs, normalBounds);
    } else {
      try { rawChartRef.current.series[0].setData(data, false); } catch {}
      ensureAllButtonsSelected(rawChartRef.current, 0, endMs);
      applyCutoffsAndNormalBand(rawChartRef.current, cutoffs, normalBounds);
      try { rawChartRef.current.redraw(); } catch {}
    }
  }, [view, rawPoints, cutoffs, normalBounds, endMs]);

  /* ---------------------------------- UI ---------------------------------- */
  const toggleDisabled = temporalPropertyId == null;

  return (
    <div style={{ border: "1px solid #E6E6E6", borderRadius: 6, backgroundColor: "#FFFFFF", marginBottom: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {view === "intervals" ? (
            <button
              onClick={() => setView("raw")}
              disabled={toggleDisabled}
              title={toggleDisabled ? "Raw view requires a known temporalPropertyId" : ""}
              style={{ opacity: toggleDisabled ? 0.5 : 1, border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 12 }}
            >
              Show Raw Data
            </button>
          ) : (
            <button
              onClick={() => setView("intervals")}
              style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 12 }}
            >
              Show Intervals
            </button>
          )}
        </div>
      </div>

      <div style={{ position: "relative", height: 230, border: "2px solid #E0E0E0", borderRadius: 4, background: "#fff" }}>
        <div
          ref={intervalsRef}
          style={{
            position: "absolute",
            inset: 0,
            padding: 6,
            background:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 1px, transparent 1px, transparent 40px)," +
              "linear-gradient(to bottom, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 100%)",
            backgroundSize: "40px 100%, 100% 40px",
            visibility: view === "intervals" ? "visible" : "hidden",
          }}
        />

        <div
          ref={rawRef}
          style={{ position: "absolute", inset: 0, padding: 6, background: "#fff", visibility: view === "raw" ? "visible" : "hidden" }}
        />
      </div>
    </div>
  );
}
