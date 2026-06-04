import { useMemo, useRef, useState, useLayoutEffect  } from "react";
import React from "react";


const FONT_SIZE_TABLE = 15;
const FONT_SIZE_TABLE_HEADER = 16.5;
const FONT_SIZE_HEADER = 18;

/* ------------------------------------------------------------------
   Re-usable section wrapper
   ------------------------------------------------------------------ */
const Section = React.forwardRef(
  (
    {
      title,
      children,
      style = {},
      className = "",
      fullHeight = false,
    },
    ref
  ) => {
    const base = {
      border: "1px solid #d0d0d0",
      borderRadius: 8,
      padding:16,
      background: "#fafafa",
      width: "100%",
      ...(fullHeight && {
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }),
    };
    return (
      <div ref={ref} style={{ ...base, ...style }} className={className}>
        {title && <h3 style={{ margin: "0 0 12px 0", fontWeight: 600 }}>{title}</h3>}
        {children}
      </div>
    );
  }
);

/* ------------------------------------------------------------------
   Interval → code legend
   ------------------------------------------------------------------ */
const IntervalLegend = ({ pattern }) => {
  if (!pattern || !Array.isArray(pattern.intervals)) return null;

  return (
    <table  className="inline-table mx-0 w-auto"
      style={{
        fontSize: FONT_SIZE_TABLE,
        borderCollapse: "separate",
        borderSpacing: "8px 4px",
        width: "max-content",
        whiteSpace: "nowrap"}}
    >
      <thead style={{ fontSize: FONT_SIZE_TABLE_HEADER }}>
        <tr className="font-medium">
          <th className="pr-4">Code</th>
          <th>Interval</th>
        </tr>
      </thead>
      <tbody>
        {pattern.intervals.map((intv, idx) => (
          <tr key={idx}>
            <td className="pr-4">{intv.code}</td>
            <td>{intv.label}</td>
          </tr>
        ))}
        <tr>
          <td className="pr-4" style={{fontWeight: "bold"}}>{pattern.event.code}</td>
          <td style={{fontWeight: "bold"}}>{pattern.event.name}</td>
        </tr>
      </tbody>
    </table>
  );
};


/* ------------------------------------------------------------------
   Build SVG illustration of the pattern
   ------------------------------------------------------------------ */
const renderDiagram = (pattern) => {
  if (!pattern) return { svg: null, width: 0, height: 0 };
  const barH = 26, gap = 12, W = 90, startX = 10, pad = 20;
  let bars = pattern.intervals.map((intv, i) => ({ idx: i, x1: startX, x2: startX + W }));
  const rels = pattern.relations || {};
  let changed;
  const MAX_ITERS = 100;          // קאפ קשיח
  let iter = 0;
  do {
    changed = false;
    Object.entries(rels).forEach(([key, code]) => {
      const [iA, iB] = key.split("-").map(Number);
      const A = bars[iA], B = bars[iB];
      const prevA1 = A.x1, prevA2 = A.x2, prevB1 = B.x1, prevB2 = B.x2;
      switch (code) {
        case "b": if (A.x2 + pad > B.x1) { const shift = A.x2 + pad - B.x1; B.x1 += shift; B.x2 += shift; } break;
        case "m": B.x1 = A.x2; B.x2 = B.x1 + W; break;
        case "o": if (A.x1 >= B.x1) A.x1 = B.x1 - pad; if (B.x1 <= A.x1 + pad) { B.x1 = A.x1 + pad; B.x2 = B.x1 + W; } if (A.x2 >= B.x2 - pad) { A.x2 = B.x2 - pad; } break;
        case "f": 
          A.x2 = B.x2; 
          if (A.x1 >= B.x1 - pad) { 
            A.x1 = B.x1 - pad - 20; 
          } 
          break;
        case "c": if (B.x1 - pad < A.x1) A.x1 = B.x1 - pad; if (B.x2 + pad > A.x2) A.x2 = B.x2 + pad; break;
        case "s": A.x1 = B.x1; A.x2 = A.x1 + W; if (A.x2 + pad > B.x2) B.x2 = A.x2 + pad; break;
        case "=": B.x1 = A.x1; B.x2 = A.x2; break;
        default: break;
      }
      if (A.x1 !== prevA1 || A.x2 !== prevA2 || B.x1 !== prevB1 || B.x2 !== prevB2) { changed = true; }
    });
    iter += 1;
    if (iter >= MAX_ITERS) {
      console.warn("renderDiagram: exceeded max iterations – breaking");
      break;                      
      
    }
  } while (changed);
  const minX = Math.min(...bars.map((b) => b.x1));
  if (minX < startX) { const diff = startX - minX; bars = bars.map((b) => ({ ...b, x1: b.x1 + diff, x2: b.x2 + diff })); }
  const totalH = (bars.length + 1) * (barH + gap) + 45;
  const lastEnd = Math.max(...bars.map((b) => b.x2));
  const eventX = lastEnd + 20;
  const svgW = eventX + 120;
  const svg = (
    <svg width={svgW} height={totalH}>
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={b.x1} y={i * (barH + gap)} width={b.x2 - b.x1} height={barH} rx="3" fill="#56779A" />
          <text x={(b.x1 + b.x2) / 2} y={i * (barH + gap) + barH / 2 + 4} textAnchor="middle" fill="#fff" fontSize="14">{pattern.intervals[i].code}</text>
        </g>
      ))}
      <g>
        <rect x={eventX} y={bars.length * (barH + gap)} width="78" height={barH} rx="3" fill="#8B0000" />
        <text x={eventX + 39} y={bars.length * (barH + gap) + barH / 2 + 4} textAnchor="middle" fill="#fff" fontSize="14">{pattern.event.code}</text>
      </g>
      <g>
        <line x1={startX - 10} y1={totalH - 40} x2={eventX + 68} y2={totalH - 40} stroke="#000" strokeWidth="2" />
        <polygon points={`${eventX + 68},${totalH - 45} ${eventX + 78},${totalH - 40} ${eventX + 68},${totalH - 35}`} fill="#000" />
        <text x={eventX + 85} y={totalH - 35} fontSize="14" fontWeight="bold">Time</text>
      </g>
    </svg>
  );
  return { svg, width: svgW, height: totalH };
};

/* ------------------------------------------------------------------
   Relation matrix (lower-triangle) SVG
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   Relation-matrix (lower-triangle) SVG
------------------------------------------------------------------ */
const renderRelationMatrix = (pattern) => {
  if (!pattern || !Array.isArray(pattern.intervals)) return null;
  const intervals = pattern.intervals;
  const codes     = intervals.map(iv => iv.code);
  const colLabels = codes;
  const rowLabels = [...codes.slice(1), pattern.event.code];
  const numCols = colLabels.length, numRows = rowLabels.length;
  const cellSize = 40, fontSize = 14, pad = 50;
  const width = pad + numRows * cellSize, height = pad + numCols * cellSize;
  const rels = pattern.relations || {};
  const labelDx = 0;
  const labelDy = 0;
  const labelSideDx  = -15;
  const labelSideDy  =  0;
  const getRelationCode = (i, j) => {
    if (i === rowLabels.length - 1) return "b";
    const key = `${j}-${i + 1}`;
    return rels[key] ?? "";
  };
  return (
    <svg width={width} height={height} style={{ display: "block", margin: "0px auto 0" }}>
      {rowLabels.map((label, i) => (<g key={`top-${i}`} transform={`translate(${pad + i * cellSize + cellSize - 20 + labelDx},
                       ${pad - 15 + labelDy})`}><text transform="rotate(45)" textAnchor="end" dominantBaseline="middle" fontSize={fontSize}>{label}</text></g>))}
      {colLabels.map((label, j) => (<text key={`side-${j}`} x={pad / 2 + 30 + labelSideDx} y={pad + j * cellSize + cellSize / 2 + labelSideDy} textAnchor="end" fontSize={fontSize} dominantBaseline="middle">{label}</text>))}
      {colLabels.map((_, j) => rowLabels.map((_, i) => {
          if (i + 1 <= j) return null;
          const relCode = getRelationCode(i, j);
          return (<g key={`${i}-${j}`}><rect x={pad + i * cellSize} y={pad + j * cellSize} width={cellSize} height={cellSize} fill="#f5f5f5" stroke="#ccc" /><text x={pad + i * cellSize + cellSize / 2} y={pad + j * cellSize + cellSize / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill="#333">{relCode}</text></g>);
        })
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------
   Main component
   ------------------------------------------------------------------ */
export default function PatternDetails({ pattern }) {
  const { svg } = useMemo(() => renderDiagram(pattern), [pattern]);

  const tiepEntries = useMemo(() => {
      if (Array.isArray(pattern.tieps_avg_duration)) {
          return pattern.tieps_avg_duration;
      }
      return Object.entries(pattern.tieps_avg_duration);
    }, [pattern]);



  function usePairRefs(numRows) {
  const refs = useRef(
    Array.from({ length: numRows }, () => [React.createRef(), React.createRef()])
  );
  return refs.current;
}

  const ROW_COUNT = 3;         // Relation+Stats, TP+μ/σ, TIEP+Cutoffs
  const pairRefs = usePairRefs(ROW_COUNT);
  const [pairH, setPairH] = useState(Array(3).fill(null));

useLayoutEffect(() => {
  const newH = pairRefs.map(([a, b]) =>
    Math.max(a.current?.offsetHeight || 0, b.current?.offsetHeight || 0)
  );
  setPairH(newH);
}, [pattern]);

const h = (idx) => (pairH[idx] ? { height: pairH[idx] } : {});

  if (!pattern) return null;

return (
  <div className="flex flex-col items-center gap-6">
    <table
        className="mx-auto border-separate"
        style={{ borderSpacing: "16px 16px", width: "100%" }}
    >
      <colgroup>
        <col style={{ width: "50%" }} />
        <col style={{ width: "50%" }} />
      </colgroup>

      <tbody>
        {/* ───────── Row 0 ───────── */}
        <tr className="h-full">
          <td colSpan={2} className="p-0 h-full">
            <Section fullHeight>
              <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
              >
                {React.cloneElement(svg, { style: { display: "block", margin: "0", padding: "0" } })}
              </div>
              <table
                  className="w-full border-separate"
                  style={{borderSpacing: "16px 16px"}}
              >
                <colgroup>
                  <col style={{width: "50%"}}/>
                  <col style={{width: "50%"}}/>
                </colgroup>

                <tbody>
                  <tr className="h-full">
                    <td className="p-0 h-full">
                      <IntervalLegend pattern={pattern}/>
                    </td>
                    <td className="p-0 h-full">
                      {renderRelationMatrix(pattern)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          </td>
        </tr>

        {/* ═══════════════════════════════════════════════════════════════════
            NOTE: COMMENTED OUT SECTIONS - TO RESTORE LATER, UNCOMMENT BELOW
            ═══════════════════════════════════════════════════════════════════ */}

        {/* ───────── Row 1 – Statistics ──── */}
        {/* <tr className="h-full">
          <td colSpan={2} className="p-0 h-full">
            <Section
                ref={pairRefs[0][1]}
                style={h(0)}
                fullHeight
            >
              <table
                  className="w-full mx-auto table-num-center"
                  style={{
                    fontSize: FONT_SIZE_TABLE,
                    borderCollapse: "separate",
                    borderSpacing: "8px 4px",
                    width: "100%",
                    whiteSpace: "nowrap"
                  }}
              >
                <thead
                    className="font-medium"
                    style={{fontSize: FONT_SIZE_TABLE_HEADER}}
                >
                <tr>
                  <th className="pr-4">Vertical Support</th>
                  <th className="pr-4">Mean Horizontal Support</th>
                  <th className="pr-4">Confidence</th>
                </tr>
                </thead>
                <colgroup>
                  <col style={{width: "33%"}}/>
                  <col style={{width: "33%"}}/>
                  <col style={{width: "34%"}}/>
                </colgroup>
                <tbody>
                <tr>
                  <td className="pr-4 font-medium text-center">{pattern.Vertical_Support?.toFixed(3)}</td>
                  <td className="pr-4 font-medium">{pattern.Mean_Horizontal_Support?.toFixed(3)}</td>
                  <td className="pr-4 font-medium">{pattern.confidences?.toFixed(3)}</td>
                </tr>
                </tbody>
              </table>
            </Section>
          </td>
        </tr> */}

        {/* ───────── Row 2 – Transition Prob. | μ/σ ────────── */}
        {/* <tr className="h-full">
          <td className="p-0 h-full">
            <Section
                ref={pairRefs[1][0]}
                style={h(1)}
                title="Transition Probabilities"
                fullHeight
            >
              {pattern.transition_probabilities &&
              Object.keys(pattern.transition_probabilities).length ? (
                  <table
                      className="w-full mx-auto table-num-center"
                      style={{
                        fontSize: FONT_SIZE_TABLE,
                        borderCollapse: "separate",
                        borderSpacing: "10px 4px",
                        width: "100%",
                        whiteSpace: "nowrap"
                      }}
                  >
                    <thead
                        className="font-medium"
                        style={{fontSize: FONT_SIZE_TABLE_HEADER}}
                    >
                    <tr>
                      <th className="pr-4">Prefix</th>
                      <th>P(next|prev)</th>
                    </tr>
                    </thead>

                    <tbody>
                    {Object.entries(pattern.transition_probabilities).map(([k, v]) => {
                      const display = k;
                      return (
                          <tr key={k}>
                            <td className="pr-4">{display}</td>
                            <td className="text-right">{typeof v === "number" ? v.toFixed(3) : "—"}</td>
                          </tr>
                      );
                    })}
                    </tbody>
                  </table>
              ) : (
                  <p className="italic text-gray-400 text-center">No data available</p>
              )}
            </Section>
          </td>

          <td className="p-0 h-full">
             <Section
                          ref={pairRefs[1][1]}
             style={h(1)}
             title="Per-state avg & std"
             fullHeight
             >
            {pattern.state_metrics?.length ? (
                <table
                    className="w-full mx-auto"
                    style={{
                      fontSize: FONT_SIZE_TABLE,
                      borderCollapse: "separate",
                      borderSpacing: "8px 4px",
                      width: "100%",
                      whiteSpace: "nowrap"
                    }}
                >
                  <thead
                      className="font-medium"
                      style={{fontSize: FONT_SIZE_TABLE_HEADER}}
                  >
                  <tr>
                    <th className="pr-4 text-center">State</th>
                    <th className="pr-4 text-center">avg</th>
                    <th className="text-center">std</th>
                  </tr>
                  </thead>
                  <tbody>
                  {pattern.state_metrics.map(({code, mu, sigma}) => (
                      <tr key={code}>
                        <td className="pr-4 font-medium text-center">{code}</td>
                        <td className="pr-4 text-center font-medium">{mu.toFixed(2)}</td>
                        <td className="text-center font-medium">{sigma.toFixed(2)}</td>
                      </tr>
                  ))}
                  </tbody>
                </table>
            ) : (
                <p className="italic text-gray-400 text-center">No data available</p>
            )}
          </Section>
        </td>
      </tr> */}

      {/* ───────── Row 3 – Avg. TIEP | Cut-offs ─────────── */}
      {/* <tr className="h-full">
        <td className="p-0 h-full">
          <Section
              ref={pairRefs[2][0]}
              style={h(2)}
              title="Average TIEP durations"
              fullHeight
            >
              {pattern.tieps_avg_duration ? (
                <table
                  className="w-full mx-auto table-num-center"
                  style={{
                    fontSize: FONT_SIZE_TABLE,
                    borderCollapse: "separate",
                    borderSpacing: "8px 4px",
                    width: "100%",
                    whiteSpace: "nowrap"
                  }}
                >
                  <thead
                    className="font-medium"
                    style={{ fontSize: FONT_SIZE_TABLE_HEADER }}
                  >
                    <tr>
                      <th className="pr-4">TIEPs</th>
                      <th className="text-right pl-4">Duration (sec)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tiepEntries.map(([key, duration]) => (
                       <tr key={key}>
                         <td className="pr-4">{key}</td>
                         <td className="text-right pl-4">{typeof duration==="number"?duration.toFixed(2):"—"}</td>
                       </tr>
                     ))}
                  </tbody>
                </table>
              ) : (
                <p className="italic text-gray-400 text-center">No data available</p>
              )}
            </Section>
          </td>

          <td className="p-0 h-full">
            <Section
              ref={pairRefs[2][1]}
              style={h(2)}
              title="Cut-offs"
              fullHeight
              className="items-center"
            >
              <table
                className="w-full mx-auto"
                style={{
                  fontSize: FONT_SIZE_TABLE,
                  borderCollapse: "separate",
                  borderSpacing: "8px 4px",
                  width: "100%",
                  whiteSpace: "nowrap",
                }}
              >
                <thead
                  className="font-medium"
                  style={{ fontSize: FONT_SIZE_TABLE_HEADER }}
                >
                  <tr>
                    <th className="pr-4">Property</th>
                    <th className="pr-4">Lowercutoff </th>
                    <th>Uppercutoff </th>
                  </tr>
                </thead>
                <tbody>
                  {pattern.cutoffs.map(({ code, low, high }) => (
                    <tr key={code}>
                      <td className="pr-4 font-medium text-center">{code}</td>
                      <td className="pr-4 font-medium text-center">
                        {low == null ? "−∞" : low}
                      </td>
                      <td className="pr-4 font-medium text-center">
                        {high == null ? "∞" : high}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

          </td>
        </tr> */}

        {/* ═══════════════════════════════════════════════════════════════════
            END OF COMMENTED OUT SECTIONS
            ═══════════════════════════════════════════════════════════════════ */}

        {/* ───────── Row 4 – Variable Explanations ─ */}
        <tr className="h-full">
          <td colSpan={2} className="p-0 h-full">
            <Section title="Variable Explanations" fullHeight>
              {pattern.Variable_Explanations?.length ? (
              <table
              className="w-full text-left"
              style={{
                fontSize: FONT_SIZE_TABLE,
                borderCollapse: "separate",
                borderSpacing: "6px 16px",
                width: "100%",
                whiteSpace: "nowrap"
              }}
            >

            <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "64%" }} />
              </colgroup>

              <thead
                className="font-medium"
                style={{ fontSize: FONT_SIZE_TABLE_HEADER }}
              >
                <tr>
                  <th className="pr-4 text-left" style={{ textAlign: 'left' }}>Label</th>
                  <th className="pr-4 text-left" style={{ textAlign: 'left' }}>Type</th>
                  <th className="text-left" style={{ textAlign: 'left' }}>Explanation</th>
                </tr>
              </thead>
            
              <tbody>
                {pattern.Variable_Explanations.map((v, i) => (
                  <tr key={i}>
                    <td
                      className="pr-4 text-left"
                      style={{ whiteSpace: "normal", maxWidth: 160 }}
                    >
                      {Array.isArray(v.label) ? v.label.join(".") : v.label}
                    </td>
                    <td
                      className="pr-4 text-left"
                      style={{ whiteSpace: "normal", maxWidth: 160 }}
                    >
                      {v.type}
                    </td>
                    <td
                      className="text-left"
                      style={{ whiteSpace: "normal", maxWidth: 500 }}
                    >
                      {v.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>            

              ) : (
                  <p className="italic text-gray-400 text-center">No data available</p>
              )}
            </Section>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);


}