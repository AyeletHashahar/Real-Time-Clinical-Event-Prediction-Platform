// import { useEffect, useRef } from 'react';
// import Highcharts from 'highcharts';
//
// export default function ProbabilityBox({ chartRef, probability, tte }) {
//     console.log('[ProbabilityBox] tte received →', tte);
//   const elRef = useRef(null);
//
//   /* colour map ------------------------------------------------------------ */
//   const colour =
//       probability >= 0.55 ? '#B30000' :
//       probability >= 0.40 ? '#D86B00' :
//       probability >= 0.25 ? '#E8B400' :
//                             '#C0C0C0';
//
//   /* ----------------------------------------------------------------------- */
//   const placeBox = () => {
//     const chart = chartRef.current;
//     const el    = elRef.current;
//     if (!chart || !el) return;
//
//     const { plotLeft, plotTop, plotWidth, plotHeight } = chart;          // <- here
//     const gapX =  50;   // distance from the dashed line                         // tweak → distance from the dashed line
//     const gapY = 2;   // move up/down
//
//     const left = plotLeft + plotWidth + gapX;
//     const top  = plotTop  + plotHeight / 2 - el.offsetHeight / 2 + gapY;
//
//     /* 3 –- apply ---------------------------------------------------------- */
//     el.style.left = `${left}px`;
//     el.style.top  = `${top}px`;
//   };
//
//   /* hook everything to redraw / resize / scroll --------------------------- */
//   useEffect(() => {
//     if (!chartRef.current) return;
//     placeBox();                                   // first paint
//
//     const h1 = Highcharts.addEvent(chartRef.current, 'redraw',  placeBox);
//     window.addEventListener('resize', placeBox);
//     window.addEventListener('scroll', placeBox);  // keep in place while scrolling
//
//     return () => {
//       Highcharts.removeEvent(h1);
//       window.removeEventListener('resize', placeBox);
//       window.removeEventListener('scroll', placeBox);
//     };
//   }, [chartRef]);                                 // run once
//
//   /* colour only changes when probability does ----------------------------- */
//   useEffect(() => {
//     if (elRef.current) elRef.current.style.background = colour;
//   }, [colour]);
//
//   /* ----------------------------------------------------------------------- */
//   return (
//     <div
//       ref={elRef}
//       style={{
//         position      : 'absolute',   // relative to <body>
//         width         : 30,
//         height        : 87,
//         borderRadius  : 4,
//         border        : '1px solid #444',
//         textAlign      : 'center',
//         lineHeight    : '30px',
//         fontSize      : '12px',
//         fontWeight    : 'bold',
//         color         : '#fff',
//         zIndex        : 1000,        // above the chart
//         left          : 0,           // will be updated
//         top           : 0,           // will be updated
//         boxSizing     : 'border-box',
//         background    : colour,
//         pointerEvents : 'none',
//         transition    : 'background 150ms',
//           justifyContent: 'center',
//       }}
//
//      >
//       <span
//           style={{
//             fontSize  : 11,
//             fontWeight: 'bold',
//             userSelect: 'none',
//             color     : '#fff',          // pick a readable colour
//           }}
//         >
//           { tte != null
//             ? `${tte}s`
//             : `${Math.round(probability*100)}%`
//           }
//
//       </span>
//     </div>
//   );
// }
import { useEffect, useRef, useCallback, useState  } from 'react';
import Highcharts from 'highcharts';

export default function ProbabilityBox({ chartRef, probability, tte, eventName, isEventActive = false, isEventOccurred = false, patternCount = 1 }) {
  const wrapperRef = useRef(null); // Ref for the main wrapper element
  const boxRef = useRef(null);     // Ref for the colored box element
  const [eventTime, setEventTime] = useState(null);

  // Horizontal movement padding at both ends of the long segment
  const EDGE_PADDING_PX = 14;
  const ACTIVE_GAP_PX = 3; // Move active event box more to the right
  const TTE_MAX_SECONDS = 120; // map 0..120s across the usable span

  /* colour map ------------------------------------------------------------ */
  // NOTE: Previous TTE-based color logic (kept for potential future use):
  // const colour = isEventActive ? 'rgb(150, 0, 0)' : ( // Override with darkest red when active
  //     tte >= 20 ? '#B30000' :
  //     tte >= 60 ? '#D86B00' :
  //     tte >= 80 ? '#E8B400' :
  //                           '#C0C0C0'
  // );

  // New probability-based color logic (matching EventContainer.jsx):
  const getProbabilityColor = (probability) => {
    if (probability >= 0.75) return 'rgb(202, 18, 18)';
    if (probability >= 0.55) return 'rgb(211, 75, 21)';
    if (probability >= 0.3) return 'rgb(224, 136, 35)';
    return '#C0C0C0'; // Default light gray for low probabilities
  };

  const colour = isEventOccurred ? 'rgb(150, 0, 0)' : getProbabilityColor(probability);
  const stickBoxToLine = isEventOccurred;

  /* Logic to place the entire component (wrapper) ----------------------- */
  const placeBox = useCallback(() => {
    const chart = chartRef.current;
    const wrapperEl = wrapperRef.current; // Use the wrapper for positioning
    if (!chart || !wrapperEl) return;

    const { plotLeft, plotTop, plotWidth, plotHeight } = chart;
    const gapY = 20;   // vertical offset for the whole group (reduced by 2px to move higher)

    // Calculate anchor at the right edge of the plot area (same as RightEdgeLine and HorizontalRefLine)
    const rightEdgeX = plotLeft + plotWidth;

    // HorizontalRefLine long segment: from (rightEdgeX + 40) to (chart.chartWidth - 10)
    // Apply 14px safety margin on both ends so the box cannot reach the edges
    const longSegmentStart = rightEdgeX + 40;
    const longSegmentEnd = chart.chartWidth - 10;
    const safeStart = longSegmentStart + EDGE_PADDING_PX;
    const safeEnd = longSegmentEnd - EDGE_PADDING_PX;

    // Account for the box width so it fully stays within [safeStart, safeEnd]
    const boxWidth = (boxRef.current && boxRef.current.offsetWidth) || 30;

    // When event occurred → stay close to the right edge line
    let leftPx;
    if (stickBoxToLine) {
      const dynamicGapX = ACTIVE_GAP_PX; // unchanged active behavior
      leftPx = rightEdgeX + dynamicGapX;
    } else {
      // Compute allowed gap range relative to right edge
      const minGapX = Math.max(0, safeStart - rightEdgeX);
      const maxGapX = Math.max(minGapX, (safeEnd - boxWidth) - rightEdgeX);

      // Map tte across the full usable segment. Use 0..120s to span the range
      let desiredGapX;
      if (tte != null && typeof tte === 'number') {
        const tteClamped = Math.min(Math.max(tte, 0), TTE_MAX_SECONDS);
        const span = maxGapX - minGapX;
        const frac = span > 0 ? tteClamped / TTE_MAX_SECONDS : 0;
        desiredGapX = minGapX + span * frac;
      } else {
        // If no tte, place roughly one-third into the segment
        desiredGapX = minGapX + (maxGapX - minGapX) * 0.33;
      }

      // Clamp to the safe range
      const dynamicGapX = Math.min(Math.max(desiredGapX, minGapX), maxGapX);
      leftPx = rightEdgeX + dynamicGapX;
    }

    // Vertical placement remains unchanged
    const top  = plotTop  + plotHeight / 2 - wrapperEl.offsetHeight / 2 + gapY;

    wrapperEl.style.left = `${leftPx}px`;
    wrapperEl.style.top  = `${top}px`;
  }, [chartRef, tte, stickBoxToLine]); // constrained to HorizontalRefLine long segment

  /* Effect for positioning the wrapper ---------------------------------- */
  useEffect(() => {
    if (!chartRef.current || !wrapperRef.current) return;

    placeBox(); // Call for initial placement and when dependencies change

    const chart = chartRef.current;
    const h1 = Highcharts.addEvent(chart, 'redraw',  placeBox);
    window.addEventListener('resize', placeBox);

    return () => {
      Highcharts.removeEvent(h1);
      window.removeEventListener('resize', placeBox);
    };
  }, [chartRef, tte, placeBox]);

  /* Effect for updating the background color of the box ----------------- */
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.style.background = colour;
    }
  }, [colour]);

  /* Previous implementation: Calculate and format the event time based on chart's x-axis max */
  /* useEffect(() => {
    const chart = chartRef.current;
    if (tte != null && typeof tte === 'number' && chart && chart.xAxis && chart.xAxis[0]) {
      const xAxis = chart.xAxis[0];
      const graphCurrentTime = xAxis.max; // This is the timestamp at the right edge of the graph
      if (graphCurrentTime != null) {
        const eventTimestamp = new Date(graphCurrentTime + tte * 1000); // tte is in seconds, convert to milliseconds
        setEventTime(eventTimestamp.toLocaleTimeString([], {minute: '2-digit', second: '2-digit' }));
      } else {
        setEventTime(null);
      }
    } else {
      setEventTime(null);
    }
  }, [tte, chartRef]); // Recalculate if tte or chartRef changes */

  /* Calculate and format the estimated TTE in a user-friendly format */
  useEffect(() => {
    if (tte != null && typeof tte === 'number') {
      // Check if dataset is Falls
      const datasetName = sessionStorage.getItem("dataset_name");
      const isFallsDataset = datasetName === "Falls";
      
      if (isFallsDataset) {
        // For Falls dataset: show days
        // Convert seconds to days (60 seconds * 60 minutes * 24 hours = 86400 seconds per day)
        const days = Math.ceil(tte / 86400); // Round UP to the nearest day
        if (days > 0) {
          setEventTime(`± ${days} days`);
        } else {
          setEventTime(`± 1 days`); // Minimum 1 day display
        }
      } else {
        // For other datasets: show minutes
        // Round TTE UP to the nearest minute (60 seconds)
        const roundedTTE = Math.ceil(tte / 60) * 60;
        const minutes = Math.floor(roundedTTE / 60);
        // Format as "~ X min" where X is minutes
        if (minutes > 0) {
          setEventTime(`± ${minutes} min`);
        } else {
          setEventTime(`± 1 min`); // Minimum 1 minute display
        }
      }
      /* Previous method (minutes:seconds format):
      // Format as "~ X:XX" where X:XX is minutes:seconds
      const seconds = Math.round(roundedTTE % 60);
      if (minutes > 0) {
        setEventTime(`~ ${minutes}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setEventTime(`~ 0:${seconds.toString().padStart(2, '0')}`);
      }
      */
    } else {
      setEventTime(null);
    }
  }, [tte]); // Recalculate if tte changes

  // Show the component if event occurred OR if normal conditions are met
  if (!stickBoxToLine && (tte == null || probability < 0.3 || tte > 1000 || tte === 0)) {
      return null;
  }

  // Get the plot height from the chart (actual graphing area height)
  const chart = chartRef.current;
  const plotHeight = chart?.plotHeight || 140;

  /* ----------------------------------------------------------------------- */
  return (
    <div
      ref={wrapperRef} // This is the main wrapper
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column', // Stack box and text vertically
        alignItems: 'center',    // Center items horizontally within the wrapper
        zIndex: 2,
        left: 0,           // Positioned by placeBox
        top: 0,            // Positioned by placeBox
        pointerEvents: 'none', // Click-through for the wrapper
        // transition: 'left 300ms ease-out, top 300ms ease-out', // Smooth movement 
      }}
    >
      {/* The colored box itself */}
      <div
        ref={boxRef}
        style={{
          width: 30,
          height: plotHeight, // Use the actual plot area height
          borderRadius: 4,
          border: '1px solid #444',
          // background color is set by the useEffect above
          transition: 'background 150ms', // Smooth color change
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',       // Text color for probability %
          fontSize: '12px',
          fontWeight: 'bold',
          boxSizing: 'border-box',
          writingMode: 'vertical-lr', // Vertical text, right-to-left
          whiteSpace: 'nowrap', // Prevent wrapping
        }}
      >
        {patternCount === 1 && eventName ? eventName.substring(0, 2) : eventName}
      </div>

      {/* TTE or Active label displayed below the box */}
      {(isEventOccurred || tte != null) && (
        <div
          style={{
            marginTop: '5px',
            fontSize: '12px',
            fontFamily: '"Quicksand", sans-serif',
            fontWeight: isEventOccurred ? 'bold' : 'normal',
            color: isEventOccurred ? 'rgb(150, 0, 0)' : '#333333',
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          {isEventOccurred ? 'Active' : eventTime}
        </div>
      )}
    </div>
  );
}