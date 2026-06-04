// src/research/StaticPatternFocusPage.jsx
import React, { useEffect, useState } from "react";
import StaticPatternIntervals from "./StaticPatternIntervals";
import StaticVariableGraph from "./StaticVariableGraph";
import DataManagementService from "../dataService/DataManagementService";

export default function StaticPatternFocusPage({ pattern, endTime }) {
  const patternIndex = pattern?.patternIndex ?? pattern?.index ?? 0;
  const eventIndex   = pattern?.eventIndex ?? pattern?.eventId ?? 0;

  // End time (seconds) to clamp the static window 0..endTime
  const endTimeSec   = Number(pattern?.endTimeSec ?? endTime ?? 50);

  // NEW: hold the selected predictor instances so we can mirror highlights in variable graphs
  const [selectedInstances, setSelectedInstances] = useState(null);

  const [propertyIds, setPropertyIds] = useState([]);
  const [fallbackVars, setFallbackVars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const patterns = await DataManagementService.fetchAllPatterns(eventIndex);
        const found    = Array.isArray(patterns)
          ? patterns.find((p) => p?.index === patternIndex)?.patternData
          : null;

        const stateIds   = Array.isArray(found) ? found[0] : null;
        const categories = Array.isArray(found) ? (found[1] ?? []) : [];

        let ids = [];
        if (stateIds && stateIds.length) {
          ids = await DataManagementService.fetchRelatedTemporalPropertyIds(stateIds, eventIndex);
        }
        if (alive) setPropertyIds(Array.isArray(ids) ? ids : []);

        if (!ids || ids.length === 0) {
          // Build fallback groups (variable title + state labels) from categories "var.state"
          const groups = new Map();
          for (const c of categories) {
            const [varName, stateLabel] = String(c).split(".");
            if (!groups.has(varName)) groups.set(varName, new Set());
            if (stateLabel) groups.get(varName).add(stateLabel);
          }
          const order = new Map([["Very Low",-2],["Low",-1],["Medium",0],["High",1],["Very High",2]]);
          const list = [...groups.entries()].map(([title, set]) => {
            const arr = [...set];
            arr.sort((a,b)=> (order.has(a)||order.has(b)) ? (order.get(a)||0)-(order.get(b)||0) : a.localeCompare(b));
            return { title, states: arr };
          });
          if (alive) setFallbackVars(list);
        } else {
          if (alive) setFallbackVars([]);
        }
      } catch (e) {
        console.error("[StaticPatternFocusPage] load failed:", e);
        if (alive) { setPropertyIds([]); setFallbackVars([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [patternIndex, eventIndex]);

  return (
    <div style={{ padding: 12 }}>
      {/* Central pattern graph (no 'Focus' button inside the focus page) */}
      <div style={{ backgroundColor: "#F7F7F7", border: "2px solid #E0E0E0", borderRadius: 4, marginBottom: 12 }}>
        <StaticPatternIntervals
          patternIndex={patternIndex}
          eventIndex={eventIndex}
          endTimeSec={endTimeSec}
          showFocus={false}
          // bubble the chosen predictor instances upward
          onSelectInstances={setSelectedInstances}
        />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {loading && <div style={{ fontSize: 13, color: "#6b7280" }}>Loading variables…</div>}

        {/* Real property ids found → render true variable graphs */}
        {propertyIds.length > 0 &&
          propertyIds.map((pid) => (
            <StaticVariableGraph
              key={`${eventIndex}-${pid}`}
              temporalPropertyId={pid}
              eventIndex={eventIndex}
              endTimeSec={endTimeSec}
              // mirror the chosen highlights from the pattern graph
              highlightInstances={selectedInstances}
            />
          ))}

        {/* Fallback (no ids) → show by var name + state labels only */}
        {propertyIds.length === 0 && !loading && fallbackVars.length > 0 &&
          fallbackVars.map((v, i) => (
            <StaticVariableGraph
              key={`fallback-${i}`}
              eventIndex={eventIndex}
              endTimeSec={endTimeSec}
              titleOverride={v.title}
              stateLabelsOverride={v.states}
              highlightInstances={selectedInstances} // will highlight only if StateIDs exist (in fallback they usually don't)
            />
          ))}

        {!loading && propertyIds.length === 0 && fallbackVars.length === 0 && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No variables found for this pattern.</div>
        )}
      </div>
    </div>
  );
}
