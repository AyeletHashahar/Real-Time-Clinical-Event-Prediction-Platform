// src/research/StaticPatternDetails.jsx
import React, { useState } from "react";
import StaticVariableGraph from "./StaticVariableGraph";

/**
 * Static-only "focused pattern" details.
 * Renders the variables contained in a pattern, each with interval/raw placeholders.
 * No data is fetched; this is UI only.
 */
export default function StaticPatternDetails({
  patternIndex,
  variables = [],        // [{ id, title }]
}) {
  // Per-variable view state: { [id]: 'intervals' | 'raw' | null }
  const [viewByVar, setViewByVar] = useState({});

  const setView = (id, view) =>
    setViewByVar((prev) => ({ ...prev, [id]: view }));

  return (
    <div style={{
      marginTop: 8,
      marginBottom: 14,
      padding: "10px 10px 2px",
      border: "1px dashed #D7DCE2",
      borderRadius: 8,
      background: "#FAFBFC"
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Variables in Pattern {patternIndex}
      </div>

      {variables.map((v) => (
        <StaticVariableGraph
          key={v.id}
          title={v.title}
          view={viewByVar[v.id] ?? null}
          onShowIntervals={() => setView(v.id, "intervals")}
          onShowRaw={() => setView(v.id, "raw")}
        />
      ))}
    </div>
  );
}
