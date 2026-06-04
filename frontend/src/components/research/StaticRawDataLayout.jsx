// src/research/StaticRawDataLayout.jsx
// Static snapshot page with graphs. Builds a 1s time-grid (0..endTime) so every
// second exists on the X-axis (nulls for missing). Types & labels are fetched
// from the server (merged across ALL events). Also overlays lower/upper normal
// band and dashed cutoff lines. Design is unchanged.

import React, { useMemo, useRef, useState, useEffect } from "react";
import Highcharts from "highcharts/highstock";
import DataManagementService from "../dataService/DataManagementService";
import RawDataGraph from "../rawData/RawDataGraph";
import {
  FaVials,
  FaBedPulse,
  FaSyringe,
  FaDroplet,
  FaFlask,
  FaLungs,
  FaGlassWaterDroplet,
  FaXRay,
} from "react-icons/fa6";

/* ----------------------------- icons by type ----------------------------- */
const typeToIcon = {
  Labs: <FaVials style={{ color: "#484949" }} />,
  "Blood Gas": <FaDroplet style={{ color: "#484949" }} />,
  Chemistry: <FaFlask style={{ color: "#484949" }} />,
  Respiratory: <FaLungs style={{ color: "#484949" }} />,
  Output: <FaGlassWaterDroplet style={{ color: "#484949" }} />,
  "Vital Signs": <FaBedPulse style={{ color: "#484949" }} />,
  "Routine Vital Signs": <FaBedPulse style={{ color: "#484949" }} />,
  Procedures: <FaSyringe style={{ color: "#484949" }} />,
  Radiology: <FaXRay style={{ color: "#484949" }} />,
};

/* ------------------------------ toolbar bits ----------------------------- */
function HeaderButton({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

function TypeButton({ typeName, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="btn-reset flex items-center gap-2 w-full text-left select-none mb-4"
      style={{
        fontSize: 18,
        fontWeight: 600,
        background: "transparent",
        border: "none",
        padding: "8px 0",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      {open ? "▾" : "▸"}
      {typeToIcon[typeName] && (
        <span style={{ marginLeft: 8, marginRight: 8 }}>{typeToIcon[typeName]}</span>
      )}
      {typeName}
    </button>
  );
}

/* ------------------------------ static service --------------------------- */
const DummyDataUpdateService = {
  addListener: () => {},
  removeListener: () => {},
  addTimestampListener: () => {},
  removeTimestampListener: () => {},
  getStoredData: () => [],
};

/* ------------------------------ no-data row ------------------------------ */
function NoDataRow({ title }) {
  return (
    <div
      style={{
        height: 52,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#374151",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#9CA3AF", whiteSpace: "nowrap" }}>
        No Data Available
      </div>
    </div>
  );
}

/* ------------------------------ data helpers ----------------------------- */
/** Sort, de-dup timestamps, keep non-null if any at same second, coerce "None"→null. */
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

/**
 * Expand a series to a regular 1s grid from startSec to endSec (inclusive).
 * Any missing seconds get `{ raw_value: null }`, so every second appears on X.
 */
function expandToSecondGrid(series, startSec, endSec) {
  const map = new Map(series.map((p) => [Number(p.time), p]));
  const out = [];
  for (let t = startSec; t <= endSec; t += 1) {
    const p = map.get(t);
    if (p) {
      out.push({ time: t, raw_value: p.raw_value, state_id: p.state_id ?? null, bin_id: p.bin_id ?? null });
    } else {
      out.push({ time: t, raw_value: null, state_id: null, bin_id: null });
    }
  }
  return out;
}

/** Force "All" (0..endSec) on the x-axis, even if another component tries to zoom. */
function enforceFullSpan(graphId, startSec, endSec) {
  const min = startSec * 1000;
  const max = endSec * 1000;
  const tryApply = () => {
    const chart =
      Highcharts?.charts?.find((c) => c && c.renderTo && c.renderTo.id === graphId) || null;
    if (!chart || !chart.xAxis || !chart.xAxis[0]) return false;

    // Click the "All" range button if present
    try {
      const rs = chart.rangeSelector;
      if (rs && rs.buttonOptions) {
        const allIdx = rs.buttonOptions.findIndex((b) => b.type === "all");
        if (allIdx >= 0 && rs.buttons && rs.buttons[allIdx]) {
          rs.clickButton(allIdx, rs.buttons[allIdx], true);
        }
      }
    } catch (_) {}

    try {
      chart.xAxis[0].setExtremes(min, max, true, false);
    } catch (_) {}
    return true;
  };
  [0, 80, 200, 400].forEach((delay) => setTimeout(tryApply, delay));
}

/** Apply cutoffs (as dashed plotLines) and normal band to a mounted chart */
function applyCutoffsAndNormalBand(graphId, cutoffsRows = [], normalBounds = null) {
  const tryApply = () => {
    const chart = Highcharts?.charts?.find((c) => c && c.renderTo && c.renderTo.id === graphId) || null;
    if (!chart || !chart.yAxis || !chart.yAxis[0]) return false;

    // Build dashed plotLines from cutoffs (unique finite values)
    const values = [];
    cutoffsRows.forEach((r) => {
      const low = Number(r?.BinLow ?? r?.low ?? r?.lo ?? r?.min ?? r?.Min);
      const high = Number(r?.BinHigh ?? r?.high ?? r?.hi ?? r?.max ?? r?.Max);
      if (Number.isFinite(low)) values.push(low);
      if (Number.isFinite(high)) values.push(high);
    });
    // Deduplicate with epsilon tolerance
    const eps = 1e-9;
    const uniq = [];
    values.sort((a,b)=>a-b).forEach((v) => {
      if (uniq.length === 0 || Math.abs(uniq[uniq.length-1] - v) > eps) uniq.push(v);
    });

    const plotLines = uniq.map((v) => ({
      value: v,
      color: '#9CA3AF',
      width: 1,
      dashStyle: 'ShortDash',
      zIndex: 4,
      label: { text: '', align: 'right', x: -6, style: { fontSize: '10px', color: '#6B7280' } }
    }));

    // Normal band
    let plotBands = [];
    if (Array.isArray(normalBounds) && normalBounds.length === 2) {
      const low = Number(normalBounds[0]);
      const high = Number(normalBounds[1]);
      if (Number.isFinite(low) && Number.isFinite(high)) {
        plotBands.push({
          from: low,
          to: high,
          color: 'rgba(144, 238, 144, 0.15)' // light green
        });
      }
    }

    try {
      chart.yAxis[0].update({ plotBands, plotLines }, true);
    } catch (_) {}

    return true;
  };

  [0, 120, 360].forEach((delay) => setTimeout(tryApply, delay));
}

/* --------------------------------- main ---------------------------------- */
export default function StaticRawDataLayout({
  title = "Raw Data Snapshot",
  endTime,              // upper bound in seconds since t=0 (page-entry time)
  eventId: eventIdProp, // optional override for fetching state labels
}) {
  // Groups from server: { [type]: [{ id, label }] }
  const [serverGroups, setServerGroups] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Final series per property (expanded to 1s grid 0..endTime)
  const [seriesByProperty, setSeriesByProperty] = useState({});
  // Optional state labels per property (for RawDataGraph)
  const [statesMap, setStatesMap] = useState({});

  // Cutoffs + normal bounds for overlays
  const [cutoffsByProperty, setCutoffsByProperty] = useState({});
  const [normalBoundsByProperty, setNormalBoundsByProperty] = useState({});

  // UI state
  const [openByType, setOpenByType] = useState({});
  const [query, setQuery] = useState("");
  const [eventId, setEventId] = useState(0);
  const typeRefs = useRef({});

  /* 1) Fetch **all events**, merge types across events (unique IDs), and merge labels. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all events
        const events = await DataManagementService.fetchAllEvents();
        if (!alive) return;

        // Use the provided eventId (if any) or the first event for state labels later
        const fallbackEventId =
          typeof eventIdProp === "number"
            ? eventIdProp
            : (Array.isArray(events) && events.length > 0 && typeof events[0]?.id === "number"
                ? events[0].id
                : 0);
        setEventId(fallbackEventId);

        // Merge types across all events
        const typeData = {};
        const labelData = {};

        for (const ev of (events || [])) {
          try {
            const [eventTypes, eventLabels] = await Promise.all([
              DataManagementService.fetchTemporalPropertyTypes(ev.id),
              DataManagementService.fetchTemporalPropertyLabels(ev.id),
            ]);

            // Merge types
            Object.entries(eventTypes || {}).forEach(([typeName, propertyIds]) => {
              if (!typeData[typeName]) typeData[typeName] = [];
              (propertyIds || []).forEach((id) => {
                if (!typeData[typeName].includes(id)) typeData[typeName].push(id);
              });
            });

            // Merge labels (first non-empty label wins)
            Object.entries(eventLabels || {}).forEach(([id, label]) => {
              if (label == null || label === "") return;
              if (labelData[id] == null) labelData[id] = label;
            });
          } catch (err) {
            console.error(`Error merging types/labels for event ${ev?.id}:`, err);
          }
        }

        // Build { type: [{id,label}] }
        const groups = {};
        Object.entries(typeData).forEach(([typeName, ids]) => {
          groups[typeName] = (ids || []).map((id) => ({
            id,
            label: labelData?.[id] ?? `Property ${id}`,
          }));
        });

        if (!alive) return;
        setServerGroups(groups);

        const initOpen = {};
        Object.keys(groups).forEach((t) => (initOpen[t] = false));
        setOpenByType(initOpen);

        if (Object.keys(groups).length === 0) {
          setError("No properties were found on the server.");
        }
      } catch (e) {
        console.error("StaticRawDataLayout: failed to load groups/titles", e);
        if (!alive) return;
        setError("Failed to load property groups from server.");
        setServerGroups({}); // no demo fallback
        setOpenByType({});
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdProp]);

  /* 2) Fetch frames and build per-property 1s grid from 0..endTime */
  useEffect(() => {
    if (endTime == null) return;
    if (!serverGroups || Object.keys(serverGroups).length === 0) return;

    const startSec = 0;
    const endSec = Math.max(0, Math.floor(Number(endTime)));

    let alive = true;
    (async () => {
      try {
        // Server returns: [{ <propId>: {time, state_id, bin_id, raw_value}, ... }, ...]
        const frames = await DataManagementService.fetchEntityDataFromOneEvent({
          eventId: 0,
          endTime: endSec,
        });
        if (!alive) return;

        // bucket raw points per property
        const rawByProp = {};
        for (const row of frames) {
          for (const [propIdKey, point] of Object.entries(row || {})) {
            const propId = String(propIdKey);
            if (!rawByProp[propId]) rawByProp[propId] = [];
            rawByProp[propId].push({
              time: Number(point?.time) || 0,
              raw_value: point?.raw_value,
              state_id: point?.state_id ?? null,
              bin_id: point?.bin_id ?? null,
            });
          }
        }

        // sanitize + expand to 1s grid (0..endSec)
        const filled = {};
        Object.entries(rawByProp).forEach(([propId, list]) => {
          const clean = sanitizeSeries(list);
          const grid = expandToSecondGrid(clean, startSec, endSec);
          filled[propId] = grid;
        });

        setSeriesByProperty(filled);

        // Overlays for the props we actually have data for
        const ids = Object.keys(filled);

        // Normal bounds (two numbers per id)
        const allBounds = await DataManagementService.fetchAllNormalBounds();
        const nb = {};
        ids.forEach((id) => {
          const b = allBounds?.[id];
          if (Array.isArray(b) && b.length === 2) nb[id] = b;
        });
        if (alive) setNormalBoundsByProperty(nb);

        // Cutoffs per property
        const cutPairs = await Promise.all(
          ids.map(async (id) => {
            try {
              const rows = await DataManagementService.fetchTemporalPropertyCutoffs(id, 0);
              // normalize keys
              const norm = Array.isArray(rows)
                ? rows.map((r) => ({
                    BinID: r?.BinID ?? r?.bin_id ?? r?.binId ?? r?.id ?? null,
                    BinLabel: r?.BinLabel ?? r?.label ?? null,
                    BinHigh: (r?.BinHigh ?? r?.high ?? r?.hi ?? null),
                    BinLow:  (r?.BinLow  ?? r?.low  ?? r?.lo ?? null),
                  }))
                : [];
              return [id, norm];
            } catch {
              return [id, []];
            }
          })
        );
        if (alive) setCutoffsByProperty(Object.fromEntries(cutPairs));
      } catch (err) {
        console.error("Failed to load entity_data frames:", err);
      }
    })();

    return () => { alive = false; };
  }, [endTime, serverGroups]);

  /* 3) Optional: state labels per property (use the chosen/fallback event id) */
  useEffect(() => {
    if (!serverGroups || Object.keys(serverGroups).length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const allIds = Object.values(serverGroups).flat().map((it) => String(it.id));
        const uniq = Array.from(new Set(allIds));
        const map = {};
        for (const id of uniq) {
          try {
            const states = await DataManagementService.fetchStates(id, eventId);
            map[id] = states || [];
          } catch {
            map[id] = [];
          }
        }
        if (!cancelled) setStatesMap(map);
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, [serverGroups, eventId]);

  /* 4) Enforce 0..endTime extent and apply overlays after mount/toggle */
  useEffect(() => {
    const endSec = Math.max(0, Math.floor(Number(endTime || 0)));
    if (!endSec) return;
    Object.entries(seriesByProperty).forEach(([propId, series]) => {
      if (!series?.length) return;
      const graphId = `static-raw-graph-${propId}`;
      enforceFullSpan(graphId, 0, endSec);
      applyCutoffsAndNormalBand(graphId, cutoffsByProperty[propId], normalBoundsByProperty[propId]);
    });
  }, [seriesByProperty, endTime, cutoffsByProperty, normalBoundsByProperty]);

  useEffect(() => {
    if (!serverGroups) return;
    const endSec = Math.max(0, Math.floor(Number(endTime || 0)));
    if (!endSec) return;
    Object.entries(openByType).forEach(([typeName, isOpen]) => {
      if (!isOpen) return;
      (serverGroups[typeName] || []).forEach((p) => {
        const propId = String(p.id);
        const series = seriesByProperty[propId];
        if (series && series.length) {
          const graphId = `static-raw-graph-${propId}`;
          enforceFullSpan(graphId, 0, endSec);
          applyCutoffsAndNormalBand(graphId, cutoffsByProperty[propId], normalBoundsByProperty[propId]);
        }
      });
    });
  }, [openByType, serverGroups, seriesByProperty, endTime, cutoffsByProperty, normalBoundsByProperty]);

  /* ------------------------------- render -------------------------------- */
  const groupsToRender = serverGroups || {};
  const sortedTypes = useMemo(
    () => Object.keys(groupsToRender).sort(),
    [groupsToRender]
  );

  const filteredGroups = useMemo(() => {
    if (!Object.keys(groupsToRender).length) return {};
    if (!query.trim()) return groupsToRender;
    const q = query.toLowerCase();
    const next = {};
    for (const [type, items] of Object.entries(groupsToRender)) {
      const keep = items.filter((it) => String(it.label).toLowerCase().includes(q));
      if (keep.length) next[type] = keep;
    }
    return next;
  }, [groupsToRender, query]);

  const allOpen = Object.values(openByType).length > 0 && Object.values(openByType).every(Boolean);
  const allClosed = Object.values(openByType).length > 0 && Object.values(openByType).every((v) => !v);

  const handleExpandAll = () => {
    const obj = {};
    sortedTypes.forEach((t) => (obj[t] = true));
    setOpenByType(obj);
  };
  const handleCollapseAll = () => {
    const obj = {};
    sortedTypes.forEach((t) => (obj[t] = false));
    setOpenByType(obj);
  };

  const jumpTo = (type) => {
    if (!type) return;
    setOpenByType((prev) => ({ ...prev, [type]: true }));
    const el = typeRefs.current[type];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%", background: "#FFFFFF" }}>
      {/* Toolbar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: "#fffffff7",
          borderBottom: "1px solid #e5e7eb",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginRight: 8 }}>
          {title}
        </div>

        <HeaderButton onClick={handleExpandAll} disabled={allOpen}>Expand all</HeaderButton>
        <HeaderButton onClick={handleCollapseAll} disabled={allClosed}>Collapse all</HeaderButton>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "#374151" }}>Jump to</label>
          <select
            onChange={(e) => jumpTo(e.target.value)}
            defaultValue=""
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}
          >
            <option value="" disabled>Choose type</option>
            {sortedTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <input
            placeholder="Search property…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 220, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13 }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ overflow: "auto", padding: "16px 12px 10px 12px", minHeight: 0 }}>
        {loading && (
          <div style={{ padding: 12, marginBottom: 12, border: "1px dashed #e5e7eb", borderRadius: 10, color: "#6b7280", background: "#fafafa" }}>
            Loading variable names…
          </div>
        )}

        {error && (
          <div style={{ padding: 12, marginBottom: 12, border: "1px solid #fee2e2", borderRadius: 10, color: "#991b1b", background: "#fef2f2" }}>
            {error}
          </div>
        )}

        {Object.keys(filteredGroups).length === 0 && !loading && !error && (
          <div style={{ padding: 20, textAlign: "center", color: "#6b7280", border: "1px dashed #e5e7eb", borderRadius: 12, background: "#fafafa" }}>
            No properties to display.
          </div>
        )}

        {Object.entries(filteredGroups)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([typeName, items]) => (
            <div
              key={typeName}
              ref={(el) => (typeRefs.current[typeName] = el)}
              style={{
                marginBottom: 20,
                backgroundColor: "#F8F9FA",
                borderRadius: 8,
                padding: 16,
                border: "1px solid #E9ECEF",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <TypeButton
                typeName={typeName}
                open={!!openByType[typeName]}
                onToggle={() => setOpenByType((prev) => ({ ...prev, [typeName]: !prev[typeName] }))}
              />

              {openByType[typeName] && (
                <div style={{ marginLeft: 24, marginTop: 12 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    {items.map((p) => {
                      const propId = String(p.id);
                      const series = seriesByProperty[propId] || [];
                      const hasData = series.length > 0;

                      return (
                        <div
                          key={`static-raw-card-${propId}`}
                          style={{
                            border: "1px solid #DEE2E6",
                            borderRadius: 6,
                            backgroundColor: "#FFFFFF",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            paddingRight: 16,
                            paddingLeft: 16,
                            margin: 0,
                          }}
                        >
                          {hasData ? (
                            <RawDataGraph
                              temporalPropertyIdToShow={propId}
                              graphId={`static-raw-graph-${propId}`}
                              DataUpdateService={DummyDataUpdateService}
                              title={p.label}
                              states={statesMap[propId] || []}
                              initialData={series}
                              onVisibilityChange={() => {}}
                              isVisible={openByType[typeName]}
                              eventId={0}
                            />
                          ) : (
                            <NoDataRow title={p.label} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
