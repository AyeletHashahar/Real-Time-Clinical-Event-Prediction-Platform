// import { useEffect, useRef, useCallback } from "react";
// import Highcharts from "highcharts/highstock";
// import xrange from "highcharts/modules/xrange";
// import DataManagementService from "../dataService/DataManagementService"; // Already imported


// xrange(Highcharts);

// // Simple debounce helper.
// const debounce = (func, delay) => {
//   let timer;
//   return (...args) => {
//     clearTimeout(timer);
//     timer = setTimeout(() => func(...args), delay);
//   };
// };

// export default function GraphIntervalsCombined({
//   temporalPropertyIdToShow,
//   graphId,
//   DataUpdateService,
//   title,
//   states,
//   initialData,
//   onVisibilityChange,
//   isVisible,
//   eventId,
//   highlightedIntervals = []
// }) {
//   const chartRef = useRef(null);
//   const stateMapRef = useRef({});
//   const currentIntervalRef = useRef(null);
//   const isRealTimeRef = useRef(true);
//   const wasVisible = useRef(false);
//   const resizeHandlerRef = useRef(null);
//   const eventIdRef = useRef(eventId);
//   const lastDataTimeRef = useRef(Date.now());

//   useEffect(() => {
//     eventIdRef.current = eventId;
//   }, [eventId]);

//   // const fetchCutoffs = async (sessionId, eventId, temporalPropertyId) => {
//   // const url = `/temporal-properties_cutoffs?session_id=${sessionId}&event_id=${eventId}&temporal_property_id=${temporalPropertyId}`;
//   //   try {
//   //     const response = await fetch(url);
//   //     const data = await response.json();
//   //     if (data.success) {
//   //       // Create ticks from the boundaries
//   //       return data.cutoffs.map(c => c.BinLow).concat(data.cutoffs[data.cutoffs.length - 1].BinHigh);
//   //     } else {
//   //       console.error("Failed to fetch cutoffs:", data.error);
//   //       return null;
//   //     }
//   //   } catch (err) {
//   //     console.error("Fetch error:", err);
//   //     return null;
//   //   }
//   // };


//   useEffect(() => {
//     if (states && states.length > 0) {
//       stateMapRef.current = states.reduce((map, state) => {
//         map[state.StateID] = state.BinLabel;
//         return map;
//       }, {});

//       const sortedStateIDs = Object.keys(stateMapRef.current).sort((a, b) => parseInt(a) - parseInt(b));
//       const categories = sortedStateIDs.map(id => stateMapRef.current[id]);

//       //  Fetch dynamic y-axis ticks
//       DataManagementService.fetchTemporalPropertyCutoffs(temporalPropertyIdToShow, eventId).then((tickValues) => {
//         console.log("fffffffffffFetched tick values:", tickValues);
//         if (tickValues && tickValues.length > 1) {
//           initializeChart(categories, sortedStateIDs, tickValues);
//         } else {
//           console.warn("Fallback to default y-axis ticks");
//           initializeChart(categories, sortedStateIDs, [0, 50, 100, 150]);
//         }

//         if (initialData.length > 0) {
//           const recentData = initialData.slice(-120);
//           populateInitialData(recentData);
//         }
//       });
//     }

//     // Cleanup on unmount.
//     return () => {
//       if (chartRef.current) {
//         if (resizeHandlerRef.current) {
//           window.removeEventListener("resize", resizeHandlerRef.current);
//         }
//         chartRef.current.destroy();
//       }
//     };
//   }, [states, initialData, eventId]); // Add eventId dependency to reinitialize chart when event changes

//   // Only call onVisibilityChange once when isVisible first becomes true.
//   useEffect(() => {
//     if (onVisibilityChange && isVisible && !wasVisible.current) {
//       onVisibilityChange();
//       wasVisible.current = true;
//     }
//   }, [onVisibilityChange, isVisible]);

//   // Update lastDataTimeRef on new data
//   useEffect(() => {
//     if (initialData && initialData.length > 0) {
//       const last = initialData[initialData.length - 1];
//       if (last && last.time) {
//         lastDataTimeRef.current = last.time * 1000;
//       }
//     }
//   }, [initialData]);

//   // Function to make intervals transparent within a specified time range
//   const makeIntervalsTransparent = useCallback((startTime, endTime) => {
//     const chart = chartRef.current;
//     if (!chart) return;

//     console.log(`[GraphIntervalsCombined] Making intervals transparent for property ${temporalPropertyIdToShow} in time range [${startTime}, ${endTime}]`);

//     const intervalSeries = chart.series[0];
//     const rawDataSeries = chart.series[1];

//     let intervalsModified = 0;
//     let rawDataModified = 0;

//     // Make overlapping intervals transparent instead of removing them
//     // Use more precise overlap detection - only delete intervals that are substantially within the range
//     intervalSeries.data.forEach((point) => {
//       const intervalStart = point.x;
//       const intervalEnd = point.x2;
      
//       // More conservative overlap detection: 
//       // Only delete if the interval center is within the deletion range
//       // OR if the interval is completely contained within the deletion range
//       const intervalCenter = (intervalStart + intervalEnd) / 2;
//       const isCompletelyContained = intervalStart >= startTime && intervalEnd <= endTime;
//       const isCenterWithinRange = intervalCenter >= startTime && intervalCenter <= endTime;
      
//       if (isCompletelyContained || isCenterWithinRange) {
//         //console.log(`[GraphIntervalsCombined] Deleting interval [${intervalStart}, ${intervalEnd}] (center: ${intervalCenter}) within range [${startTime}, ${endTime}]`);
//         point.update({
//           color: 'rgba(0,0,0,0)', // Make transparent
//           name: '', // Remove tooltip text
//         }, false);
//         intervalsModified++;
//       }
//     });

//     // Make raw data points transparent within the time range
//     rawDataSeries.data.forEach((point) => {
//       const pointTime = point.x;
//       if (pointTime >= startTime && pointTime <= endTime) {
//         point.update({
//           y: null, // Make point invisible in raw data view
//         }, false);
//         rawDataModified++;
//       }
//     });

//     console.log(`[GraphIntervalsCombined] Made ${intervalsModified} intervals and ${rawDataModified} raw data points transparent`);

//     chart.redraw();

//     // Update real-time view if needed - no need to change extremes since intervals are still there
//     if (isRealTimeRef.current && intervalSeries.data.length > 0) {
//       const lastPoint = intervalSeries.data[intervalSeries.data.length - 1];
//       chart.xAxis[0].setExtremes(lastPoint.x - 60000, lastPoint.x + 1000, true, true);
//     }
//   }, [temporalPropertyIdToShow]);

//   // Handle data updates
//   useEffect(() => {
//     const updateData = (filteredData, intervalsToFix) => {
//       if (filteredData && filteredData.time) {
//         lastDataTimeRef.current = filteredData.time * 1000;
//       }
//       if (chartRef.current && isVisible) {
//         // Handle interval deletion first if needed
//         if (intervalsToFix && Array.isArray(intervalsToFix)) {
//           const [startTime, endTime] = intervalsToFix;
//           makeIntervalsTransparent(startTime * 1000, endTime * 1000);
//         }
//         // Then update with new data
//         updateChart(filteredData);
//       }
//     };

//     if (isVisible) {
//       DataUpdateService.addListener(temporalPropertyIdToShow, updateData, eventId);
//     } else {
//       DataUpdateService.removeListener(temporalPropertyIdToShow, updateData, eventId);
//     }

//     return () => {
//       DataUpdateService.removeListener(temporalPropertyIdToShow, updateData, eventId);
//     };
//   }, [isVisible, temporalPropertyIdToShow, DataUpdateService, eventId, makeIntervalsTransparent]);

//   // When the graph becomes visible, always trigger a "Real Time" update by simulating a click.
//   useEffect(() => {
//     if (isVisible && chartRef.current) {
//       const realTimeButton = chartRef.current.customButtons?.realTimeButton;
//       if (realTimeButton && realTimeButton.element) {
//         realTimeButton.element.dispatchEvent(
//           new MouseEvent("click", { bubbles: true, cancelable: true })
//         );
//       }
//     }
//   }, [isVisible]);

//   // Real-time extension of open highlighted intervals
//   useEffect(() => {
//     let intervalId = null;
//     function updateHighlightSeries() {
//       if (!chartRef.current) return;
//       let highlightSeries = chartRef.current.series.find(s => s.name === 'Highlights');
//       if (!highlightSeries) return;
      
//       const now = lastDataTimeRef.current + 1000;
//       const highlightData = (highlightedIntervals || []).map(interval => {
//         // Find the corresponding state to get bin boundaries
//         const stateObj = states.find(s => s.StateID === interval.stateId);
//         const binLow = stateObj?.BinLow ?? 0;
//         const binHigh = stateObj?.BinHigh ?? 0;
        
//         // Calculate height based on bin boundaries
//         const height = Math.max(0.1, binHigh - binLow); // Ensure minimum height
        
//         return {
//           x: interval.start,
//           x2: interval.end || now,
//           y: binLow,
//           height: height,
//           name: '',
//           color: 'rgba(103, 136, 168, 0.70)',
//           borderRadius: 0,
//         };
//       });
      
//       highlightSeries.setData(highlightData, false);
//       chartRef.current.redraw();
//     }
    
//     if (highlightedIntervals && highlightedIntervals.length > 0) {
//       intervalId = setInterval(updateHighlightSeries, 1000);
//       updateHighlightSeries();
//     } else if (chartRef.current) {
//       let highlightSeries = chartRef.current.series.find(s => s.name === 'Highlights');
//       if (highlightSeries) {
//         highlightSeries.setData([], false);
//         chartRef.current.redraw();
//       }
//     }
//     return () => {
//       if (intervalId) clearInterval(intervalId);
//     };
//   }, [highlightedIntervals, states]);

//   const numericBands = states.slice().sort((a, b) => (a.BinLow ?? -1e9) - (b.BinLow ?? -1e9))
//   .map(({ BinLow, BinHigh, BinLabel }, i) => ({
//     from : BinLow  ?? -Infinity,
//     to   : BinHigh ??  Infinity,
//     color: i % 2
//       ? "rgba(0, 120, 212, .07)"    // שתי אטימות מתחלפות
//       : "rgba(100, 180, 255, .07)",
//     label: {
//       text : BinLabel,
//       align: "left",
//       x    : 4,
//       style: { fontSize: "12px", color: "#444" },
//       verticalAlign: "middle"
//     },
//     zIndex: 0
//   }));

//   // cutoffs = [{ BinLow, BinHigh, BinLabel }, …]  (מ-backend)
// const buildBands = bins =>                // bins = [{BinLow, BinHigh, BinLabel}, …]
//   bins
//     .sort((a, b) => (a.BinLow ?? -1e9) - (b.BinLow ?? -1e9))
//     .map(({ BinLow, BinHigh, BinLabel }, i) => ({
//       from  : BinLow  ?? -Infinity,       // תחילת ה-gap
//       to    : BinHigh ??  Infinity,       // סוף   ה-gap
//       color : i % 2
//         ? "rgba(0,120,212,.07)"
//         : "rgba(0,120,212,.14)",
//       label : {
//         text          : BinLabel,         // High / Medium / Low
//         align         : "left",           // לצד הגרף
//         x             : 4,                // מרחק קטן פנימה
//         verticalAlign : "middle",         // ⬅︎ מדביק בדיוק במרכז ה-band
//         style         : { fontSize: "12px", color: "#444" }
//       },
//       zIndex : 0
//     }));

//   const initializeChart = (categories, sortedStateIDs, rawYAxisTicks) => {
//     // Create transparent plotBands so that all state categories are visible.
//     const plotBands = categories.map((cat, i) => ({
//       from: i - 0.5,
//       to: i + 0.5,
//       color: "rgba(0,0,0,0)"
//     }));

//     // Format title to include event information
//     const formattedTitle = eventIdRef.current !== 0
//       ? `${title} (Event ${eventIdRef.current})`
//       : title || `Property ${temporalPropertyIdToShow}`;

//     const options = {
//       // Reduce top spacing so that the title doesn't force extra vertical space.
//       chart: {
//         type: "xrange",
//         marginLeft: 100,
//         marginRight: 30,
//         marginTop: 10,
//         spacingTop: 10,
//         spacingBottom: 10,
//         height: 230,
//         animation: false,
//         events: {
//           load: function () {
//             chartRef.current = this;

//             const updateButtonPositions = () => {
//               const chart = chartRef.current;
//               const chartWidth = chart.chartWidth;
//               if (!chart.customButtons) {
//                 chart.customButtons = {};

//                 chart.customButtons.realTimeButton = chart.renderer
//                   .button("Now", chartWidth - 105, 10)
//                   .attr({ zIndex: 3, height: 6 })
//                   .on("click", function () {
//                     isRealTimeRef.current = true;
//                     const xAxis = chart.xAxis[0];
//                     if (xAxis.dataMax) {
//                       const xMax = xAxis.dataMax + 2000;
//                       const xMin = Math.max(0, xMax - 60000);
//                       xAxis.setExtremes(xMin, xMax + 1000, true, true);
//                     }
//                   })
//                   .add();

//               } else {
//                 chart.customButtons.realTimeButton.attr({ x: chartWidth - 105 });
//               }
//             };

//             updateButtonPositions();

//             // Override the chart's redraw to also update button positions.
//             chartRef.current.redraw = function () {
//               Highcharts.Chart.prototype.redraw.call(this);
//               updateButtonPositions();
//             };

//             // Debounce the resize handler.
//             resizeHandlerRef.current = debounce(() => {
//               chartRef.current.reflow();
//               updateButtonPositions();
//             }, 200);
//             window.addEventListener("resize", resizeHandlerRef.current);
//           },
//           selection: function (event) {
//             if (event.xAxis) {
//               isRealTimeRef.current = false;
//             }
//             return true;
//           }
//         }
//       },
//       accessibility: {
//         enabled: false // Disable accessibility module to remove warning
//       },
//       // Move the title from the top to the left side by making it floating.
//       title: {
//         text: formattedTitle,
//         align: "left",
//         verticalAlign: "top",
//         floating: true,
//         x: 10,
//         y: 15,
//         style: { fontSize: "18px", fontWeight: "bold" }
//       },
//       credits: { enabled: false },
//       xAxis: [
//         {
//           type: "datetime",
//           title: { text: "" },
//           min: 0,
//           max: 1,
//           animation: false,
//           labels: { format: "{value:%M:%S}", style: { fontSize: "12px" } },
//           events: {
//             setExtremes: function (e) {
//               if (e.trigger !== "syncExtremes") {
//                 isRealTimeRef.current = false;
//               }
//             }
//           }
//         }
//       ],
//       yAxis: [
//        { // 0 – Interval categories (removed - we'll use the numeric scale directly)
//          visible: false
//        },
//        { // 1 – Raw numeric scale - this will be our primary axis now
//          title: { text: "" },
//          opposite: true,
//          visible: true,
//          labels: {
//             align: "right",
//             x: 23,
//             y: 4,
//             style: { fontSize: "12px" }
//           },
//          lineWidth: 1,
//          tickPositions: rawYAxisTicks,
//          min: rawYAxisTicks[0],
//          max: rawYAxisTicks[rawYAxisTicks.length - 1],
//          plotBands: numericBands,
//          showFirstLabel: false,
//          showLastLabel: false
//        }
//      ],
//       rangeSelector: {
//         enabled: true,
//         buttons: [
//           { count: 30, type: "second", text: "30s" },
//           { count: 1, type: "minute", text: "1m" },
//           { type: "all", text: "All" }
//         ],
//         inputEnabled: false,
//         selected: 0
//       },
//       navigator: { enabled: false },
//       scrollbar: { enabled: true },
//       series: [
//         {
//           name: "Intervals",
//           data: [],
//           colorByPoint: false,
//           animation: false,
//           tooltip: { enabled: false, pointFormatter: () => "" },
//           enableMouseTracking: false,
//           borderRadius: 0,
//           zIndex: 1,
//           pointPadding: 0,
//           groupPadding: 0,
//           grouping: false,
//           yAxis: 1, // Use the numeric axis
//         },
//         {
//           name: "Raw Data",
//           type: "line",
//           data: [],
//           yAxis: 1,
//           color: ' #0F67A1',
//           lineWidth: 2,
//           marker: { enabled: true, radius: 3 },
//           animation: false,
//           zIndex: 5
//         },
//         {
//           name: "Highlights",
//           type: "xrange",
//           data: [],
//           color: "rgba(103, 136, 168, 0.70)",
//           zIndex: 10,
//           borderWidth: 0,
//           yAxis: 1, // Use the numeric axis
//           enableMouseTracking: false,
//           showInLegend: false,
//           animation: false,
//           pointPadding: 0,
//           groupPadding: 0,
//           grouping: false,
//           borderRadius: 0,
//         }
//       ]
//     };

//     Highcharts.stockChart(graphId, options);
//   };

//   const reloadSeriesData = () => {
//     const chart = chartRef.current;
//     if (!chart) return;

//     // Get the latest 120 data points from the data store.
//     const latestData = DataUpdateService.getStoredData(temporalPropertyIdToShow, eventIdRef.current).slice(-120);

//     const intervalData = [];
//     const rawData = [];

//     latestData.forEach((point) => {
//       const stateId = parseInt(point.state_id);
//       const time = point.time * 1000;
//       const rawValue = point.raw_value;
//       const label = stateMapRef.current[stateId];
      
//       // Find the corresponding state to get bin boundaries
//       const stateObj = states.find(s => s.StateID === stateId);
//       const binLow = stateObj?.BinLow ?? 0;
//       const binHigh = stateObj?.BinHigh ?? 0;
      
//       // Calculate height based on bin boundaries
//       const height = Math.max(0.1, binHigh - binLow); // Ensure minimum height

//       intervalData.push({
//         x: time,
//         x2: time + 1000,
//         y: binLow,
//         height: height,
//         name: `${label} (${rawValue})`,
//         color: '#E9EEF6',
//       });

//       rawData.push([time, rawValue]);
//     });

//     const intervalSeries = chart.series[0];
//     const rawDataSeries = chart.series[1];

//     intervalSeries.setData(intervalData, false);
//     rawDataSeries.setData(rawData, false);

//     chart.redraw();

//     if (isRealTimeRef.current && intervalData.length > 0) {
//       const lastPoint = intervalData[intervalData.length - 1];
//       chart.xAxis[0].setExtremes(lastPoint.x - 60000, lastPoint.x + 1000, true, true);
//     }
//   };

//   const populateInitialData = (data) => {
//     data.forEach((point) => updateChart(point));
//   };

//   const updateChart = (data) => {
//     const chart = chartRef.current;
//     if (!chart) return;

//     const intervalSeries = chart.series[0];
//     const rawDataSeries = chart.series[1];
//     const stateId = parseInt(data.state_id);
//     const time = data.time * 1000;
//     const label = stateMapRef.current[stateId];
//     const rawValue = data.raw_value;
    
//     // Find the corresponding state to get bin boundaries
//     const stateObj = states.find(s => s.StateID === stateId);
//     const binLow = stateObj?.BinLow ?? 0;
//     const binHigh = stateObj?.BinHigh ?? 0;
    
//     // Calculate height based on bin boundaries
//     const height = Math.max(0.1, binHigh - binLow); // Ensure minimum height
//     const y = binLow; // Position based on the lower boundary

//     // Remove any placeholder (should not occur anymore).
//     const placeholderPoint = intervalSeries.points.find((p) => p.y === y && p.x === 0);
//     if (placeholderPoint) {
//       placeholderPoint.remove(false);
//     }

//     // Check if we have a current interval at this position
//     const existingInterval = intervalSeries.points.find(p => 
//       Math.abs(p.y - y) < 0.01 && p.x2 >= time - 1000
//     );

//     if (existingInterval) {
//       existingInterval.update(
//         {
//           x2: time + 1000,
//           color: '#E9EEF6',
//         },
//         true
//       );
//       currentIntervalRef.current = existingInterval;
//     } else {
//       const newPoint = {
//         x: time,
//         x2: time + 1000,
//         y: y,
//         height: height,
//         name: `${label} (${rawValue})`,
//         color: '#E9EEF6',
//       };
//       currentIntervalRef.current = intervalSeries.addPoint(
//         newPoint,
//         true,
//         intervalSeries.data.length >= 120
//       );
//     }

//     rawDataSeries.addPoint(
//       [ time, Number(rawValue) ],
//       true,
//       rawDataSeries.data.length >= 120
//     );

//     if (isRealTimeRef.current) {
//       const lastPoint = intervalSeries.points[intervalSeries.points.length - 1];
//       if (lastPoint) {
//         chart.xAxis[0].setExtremes(lastPoint.x - 60000, lastPoint.x + 1000, true, true);
//       }
//     }
//   };

//   return (
//     <div
//       id={graphId}
//       style={{
//         height: "230px",
//         width: "100%",
//         // border: "2px solid #CCCCCC",
//         borderRadius: "4px",
//         padding: "5px",
//         margin: "0",
//         marginBottom: "0px",
//         boxSizing: "border-box"
//       }}
//     ></div>
//   );
// }
