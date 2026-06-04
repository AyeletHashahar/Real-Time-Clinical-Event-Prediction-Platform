// import { useState, useEffect, useRef, useCallback } from "react";
// import Highcharts from "highcharts/highstock";
// import xrange from "highcharts/modules/xrange";
// import DataManagementService from "../dataService/DataManagementService";
// import TimingService from "../dataService/TimingService"; 


// xrange(Highcharts);

// // Simple debounce helper.
// const debounce = (func, delay) => {
//   let timer;
//   return (...args) => {
//     clearTimeout(timer);
//     timer = setTimeout(() => func(...args), delay);
//   };
// };

// export default function GraphIntervalsOverlay({
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
//   const [showRawData, setShowRawData] = useState(false);
//   const showRawDataRef = useRef(showRawData);
//   const chartRef = useRef(null);
//   const stateMapRef = useRef({});
//   const currentIntervalRef = useRef(null);
//   const isRealTimeRef = useRef(true);
//   const wasVisible = useRef(false);
//   const resizeHandlerRef = useRef(null);
//   const eventIdRef = useRef(eventId);
//   const lastDataTimeRef = useRef(null);           // In milliseconds
//   const lastDataReceivedTimeRef = useRef(null);   // In milliseconds
//   const timingUnsubscribeRef = useRef(null);      // For centralized timing service
//   const cutoffTicksRef = useRef([]);              // Store cutoff ticks for interval height calculations

//   useEffect(() => {
//     showRawDataRef.current = showRawData;
//   }, [showRawData]);

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
//       DataManagementService.fetchTemporalPropertyCutoffs(temporalPropertyIdToShow, eventId).then((cutoffsData) => {
//         console.log("Fetched cutoffs data:", cutoffsData);
//         console.log("Type of cutoffsData:", typeof cutoffsData);
//         console.log("Is array:", Array.isArray(cutoffsData));
        
//         // Extract numeric values from cutoffs array
//         let tickValues = [];
//         if (cutoffsData && Array.isArray(cutoffsData) && cutoffsData.length > 0) {
//           console.log("First cutoff item:", cutoffsData[0]);
//           console.log("All cutoff keys:", cutoffsData.length > 0 ? Object.keys(cutoffsData[0]) : "No items");
          
//           // Extract all unique cutoff values and format as numbers
//           const cutoffSet = new Set();
          
//           cutoffsData.forEach((cutoff, index) => {
//             console.log(`Processing cutoff ${index}:`, cutoff);
            
//             // Try different possible property names
//             const possibleLowKeys = ['BinLow', 'binLow', 'low', 'min', 'start'];
//             const possibleHighKeys = ['BinHigh', 'binHigh', 'high', 'max', 'end'];
            
//             // Add BinLow/low values
//             possibleLowKeys.forEach(key => {
//               if (cutoff[key] !== undefined && cutoff[key] !== null) {
//                 const numValue = Number(cutoff[key]);
//                 if (!isNaN(numValue)) {
//                   cutoffSet.add(numValue);
//                   console.log(`Added low value: ${numValue} from key: ${key}`);
//                 }
//               }
//             });
            
//             // Add BinHigh/high values
//             possibleHighKeys.forEach(key => {
//               if (cutoff[key] !== undefined && cutoff[key] !== null) {
//                 const numValue = Number(cutoff[key]);
//                 if (!isNaN(numValue)) {
//                   cutoffSet.add(numValue);
//                   console.log(`Added high value: ${numValue} from key: ${key}`);
//                 }
//               }
//             });
            
//             // If it's just a number directly
//             if (typeof cutoff === 'number' || (!isNaN(Number(cutoff)))) {
//               const numValue = Number(cutoff);
//               cutoffSet.add(numValue);
//               console.log(`Added direct number value: ${numValue}`);
//             }
//           });
          
//           // Convert to sorted array
//           tickValues = Array.from(cutoffSet).sort((a, b) => a - b);
//           console.log("Final processed tick values:", tickValues);
//           console.log("Tick values length:", tickValues.length);
//         } else {
//           console.log("No valid cutoffs data found");
//         }
        
//         if (tickValues && tickValues.length > 1) {
//           console.log("Using custom tick values:", tickValues);
//           cutoffTicksRef.current = tickValues; // Store cutoff ticks for interval calculations
//           initializeChart(categories, sortedStateIDs, tickValues);
//         } else {
//           console.warn("Fallback to default y-axis ticks, tickValues was:", tickValues);
//           cutoffTicksRef.current = [0, 50, 100, 150]; // Store fallback ticks
//           initializeChart(categories, sortedStateIDs, [0, 50, 100, 150]);
//         }

//         // Initialize time references using centralized timing service
//         lastDataTimeRef.current = TimingService.getCurrentTimestamp();
//         lastDataReceivedTimeRef.current = TimingService.getCurrentTimestamp();

//         // Ensure real-time mode is active
//         isRealTimeRef.current = true;

//         if (initialData.length > 0) {
//           const recentData = initialData.slice(-120);
//           populateInitialData(recentData);
//         }

//         // Subscribe to centralized timing service instead of using own interval
//         if (timingUnsubscribeRef.current) {
//           timingUnsubscribeRef.current();
//         }
        
//         timingUnsubscribeRef.current = TimingService.subscribeToTimeAdvance((timestamp) => {
//           // Update our local time references
//           lastDataTimeRef.current = timestamp;
          
//           // Only update chart if it's initialized and visible
//           if (chartRef.current && isVisible) {
//             handleNoNewData(timestamp);
//           }
//         });
//       });
//     }

//     // Cleanup on unmount.
//     return () => {
//       // Unsubscribe from centralized timing service
//       if (timingUnsubscribeRef.current) {
//         timingUnsubscribeRef.current();
//         timingUnsubscribeRef.current = null;
//       }
      
//       if (chartRef.current) {
//         if (resizeHandlerRef.current) {
//           window.removeEventListener("resize", resizeHandlerRef.current);
//         }
//         chartRef.current.destroy();
//       }
//     };
//   }, [states, initialData, eventId, isVisible]); // Add eventId dependency to reinitialize chart when event changes

//   // Only call onVisibilityChange once when isVisible first becomes true.
//   useEffect(() => {
//     if (onVisibilityChange && isVisible && !wasVisible.current) {
//       onVisibilityChange();
//       wasVisible.current = true;
      
//       // When becoming visible, reload data to reflect any deletions that happened while hidden
//       if (chartRef.current) {
//         console.log(`[GraphIntervals] Graph became visible, reloading data for property ${temporalPropertyIdToShow}`);
//         reloadSeriesData(showRawDataRef.current);
//       }
//     }
//   }, [onVisibilityChange, isVisible, temporalPropertyIdToShow]);

//   // Update lastDataTimeRef on new data
//   useEffect(() => {
//     if (initialData && initialData.length > 0) {
//       const last = initialData[initialData.length - 1];
//       if (last && last.time) {
//         lastDataTimeRef.current = last.time * 1000;
//       }
//     }
//   }, [initialData]);

//   // Function to remove intervals within a specified time range
//   const removeIntervalsInTimeRange = useCallback((startTime, endTime) => {
//     const chart = chartRef.current;
//     if (!chart) return;

//     //console.log(`[GraphIntervals] Making intervals transparent for property ${temporalPropertyIdToShow} in time range [${startTime}, ${endTime}]`);

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
//         //console.log(`[GraphIntervals] Deleting interval [${intervalStart}, ${intervalEnd}] (center: ${intervalCenter}) within range [${startTime}, ${endTime}]`);
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

//     //console.log(`[GraphIntervals] Made ${intervalsModified} intervals and ${rawDataModified} raw data points transparent`);

//     // For step 2: Show both intervals and raw data
//     intervalSeries.setVisible(true, false);
//     rawDataSeries.setVisible(true, false);

//     // For step 2: Hide interval axis, show raw data axis (both series use raw data axis)
//     chart.yAxis[0].update({ visible: false }, false);
//     chart.yAxis[1].update({ visible: true }, false);

//     chart.redraw();

//     // Update real-time view if needed - no need to change extremes since intervals are still there
//     if (isRealTimeRef.current && intervalSeries.data.length > 0) {
//       const lastPoint = intervalSeries.data[intervalSeries.data.length - 1];
//       chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
//     }
//   }, [temporalPropertyIdToShow]);

//   // Also update lastDataTimeRef on live updates
//   useEffect(() => {
//     const updateData = (filteredData, intervalsToFix) => {
//       // Always update timing references when any data is received
//       if (filteredData && filteredData.time) {
//         const timestampMs = filteredData.time * 1000;
//         lastDataReceivedTimeRef.current = timestampMs;
//         lastDataTimeRef.current = timestampMs;
//       }
      
//       if (chartRef.current && isVisible) {
//         // Handle interval deletion first if needed
//         if (intervalsToFix && Array.isArray(intervalsToFix)) {
//           const [startTime, endTime] = intervalsToFix;
//           removeIntervalsInTimeRange(startTime * 1000, endTime * 1000);
//         }
//         // Then update with new data
//         updateChart(filteredData, false); // false = not transparent
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
//   }, [isVisible, temporalPropertyIdToShow, DataUpdateService, eventId, removeIntervalsInTimeRange]);

//   // Timestamp listener for continuous graph progression
//   useEffect(() => {
//     const handleTimestamp = (timestamp, entity_data, intervalsToFix) => {
//       // Always update timing references when any timestamp is received
//       const timestampMs = timestamp * 1000;
//       lastDataReceivedTimeRef.current = timestampMs;
//       lastDataTimeRef.current = timestampMs;
      
//       if (chartRef.current && isVisible) {
//         // Handle interval deletion for this property if needed
//         if (intervalsToFix && intervalsToFix[temporalPropertyIdToShow] && Array.isArray(intervalsToFix[temporalPropertyIdToShow])) {
//           const [startTime, endTime] = intervalsToFix[temporalPropertyIdToShow];
//           removeIntervalsInTimeRange(startTime * 1000, endTime * 1000);
//         }
        
//         // Check if we have actual data for this temporal property
//         const hasDataForProperty = entity_data[temporalPropertyIdToShow];
        
//         if (!hasDataForProperty) {
//           // Add transparent interval to keep graph progressing
//           //console.log(`[GraphIntervals] Adding transparent interval for property ${temporalPropertyIdToShow} at timestamp ${timestamp}`);
//           const transparentData = {
//             time: timestamp,
//             state_id: Object.keys(stateMapRef.current)[0] || 0, // Use first available state
//             raw_value: 0,
//             transparent: true
//           };
//           updateChart(transparentData, true); // true = transparent
//         }
//         // If we have actual data, it will be handled by the regular updateData callback
//       }
//     };

//     if (isVisible) {
//       DataUpdateService.addTimestampListener(eventId, handleTimestamp);
//     } else {
//       DataUpdateService.removeTimestampListener(eventId, handleTimestamp);
//     }

//     return () => {
//       DataUpdateService.removeTimestampListener(eventId, handleTimestamp);
//     };
//   }, [isVisible, eventId, temporalPropertyIdToShow, removeIntervalsInTimeRange]);

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
      
//       // Check if we're in raw data view mode
//       const isRawDataView = showRawDataRef.current;
      
//       if (isRawDataView) {
//         // For raw data view: highlight individual data points within highlighted intervals
//         const rawDataSeries = chartRef.current.series[1]; // Raw data series
//         if (!rawDataSeries) return;
        
//         const highlightedPoints = [];
        
//         // Find all raw data points that fall within any highlighted interval
//         (highlightedIntervals || []).forEach(interval => {
//           const intervalStart = interval.start;
//           const intervalEnd = interval.end || (lastDataTimeRef.current + 1000);
          
//           rawDataSeries.points.forEach((point, index) => {
//             if (point.x >= intervalStart && point.x <= intervalEnd && point.y !== null) {
//               highlightedPoints.push({
//                 x: point.x,
//                 y: point.y,
//                 marker: {
//                   enabled: true,
//                   radius: 7, // Larger radius for highlighted points
//                   fillColor: 'rgba(103, 136, 168, 0.70)', // Highlight color
//                   lineWidth: 2,
//                   lineColor: '#fff' // White border for better visibility
//                 }
//               });
//             }
//           });
//         });
        
//         // Use the highlight series as a scatter plot for highlighted points
//         highlightSeries.update({
//           type: 'scatter',
//           yAxis: 1, // Use raw data y-axis
//           data: highlightedPoints,
//           marker: {
//             enabled: true,
//             radius: 7,
//             fillColor: 'rgba(103, 136, 168, 0.70)',
//             lineWidth: 2,
//             lineColor: '#fff'
//           },
//           enableMouseTracking: false,
//           showInLegend: false
//         }, false);
        
//       } else {
//         // For interval view: highlight intervals as before
//         const stateIdToY = {};
//         if (states && states.length > 0) {
//           states.forEach((state, idx) => {
//             stateIdToY[state.StateID] = idx;
//           });
//         }
        
//         const now = lastDataTimeRef.current + 1000;
//         const highlightData = (highlightedIntervals || []).filter(interval => {
//           const hasMapping = stateIdToY[interval.stateId] !== undefined;
//           return hasMapping;
//         }).map(interval => ({
//           x: interval.start,
//           x2: interval.end || now,
//           y: stateIdToY[interval.stateId],
//           name: '',
//           color: 'rgba(103, 136, 168, 0.70)',
//           pointWidth: 20,
//           pointPadding: 0,
//           groupPadding: 0,
//           borderRadius: 0,
//         }));
        
//         // Use the highlight series as xrange for interval highlighting
//         highlightSeries.update({
//           type: 'xrange',
//           yAxis: 0, // Use interval y-axis
//           data: highlightData,
//           color: "rgba(103, 136, 168, 0.70)",
//           pointWidth: 20,
//           pointPadding: 0,
//           groupPadding: 0,
//           borderRadius: 0,
//         }, false);
//       }
      
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
//   }, [highlightedIntervals, states, showRawData]);

//   // Add handleNoNewData function for tick-forward mechanism
//   const handleNoNewData = (timestamp) => {
//     const chart = chartRef.current;
//     if (!chart) return;
    
//    // console.log(`[GraphIntervals] Handling no new data at timestamp ${timestamp} for property ${temporalPropertyIdToShow}`);
    
//     const intervalSeries = chart.series[0];
//     const rawDataSeries = chart.series[1];
    
//     // Add transparent interval to keep graph progressing
//     const transparentPoint = {
//       x: timestamp,
//       x2: timestamp + 1000,
//       y: null,
//       name: '',
//       color: 'rgba(0, 0, 0, 0)',
//     };
//     intervalSeries.addPoint(transparentPoint, false);
    
//     // Add only ONE transparent raw data point per timestamp (not per state)
//     rawDataSeries.addPoint([timestamp, null], false);
    
//     chart.redraw();
    
//     // Update real-time view if needed
//     if (isRealTimeRef.current) {
//       // For step 2: Use raw data series for real-time view (both series are visible)
//       const activeSeries = rawDataSeries;
//       const lastPoint = activeSeries.points[activeSeries.points.length - 1];
//       if (lastPoint) {
//         chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
//       }
//     }
//   };

//   // Helper function to get cutoff bin boundaries for a raw value
//   const getCutoffBinBoundaries = (rawValue, cutoffTicks) => {
//     if (!cutoffTicks || cutoffTicks.length < 2) {
//       return { yMin: rawValue, yMax: rawValue }; // Fallback
//     }
    
//     // Find which bin the raw value belongs to
//     for (let i = 0; i < cutoffTicks.length - 1; i++) {
//       const binLow = cutoffTicks[i];
//       const binHigh = cutoffTicks[i + 1];
      
//       if (rawValue >= binLow && rawValue < binHigh) {
//         return { yMin: binLow, yMax: binHigh };
//       }
//     }
    
//     // Handle edge case: value equals the highest cutoff
//     if (rawValue === cutoffTicks[cutoffTicks.length - 1]) {
//       const lastIndex = cutoffTicks.length - 1;
//       return { yMin: cutoffTicks[lastIndex - 1], yMax: cutoffTicks[lastIndex] };
//     }
    
//     // Handle case where value is higher than highest cutoff
//     if (rawValue > cutoffTicks[cutoffTicks.length - 1]) {
//       const lastIndex = cutoffTicks.length - 1;
//       return { yMin: cutoffTicks[lastIndex - 1], yMax: cutoffTicks[lastIndex] };
//     }
    
//     // Handle case where value is lower than lowest cutoff
//     if (rawValue < cutoffTicks[0]) {
//       return { yMin: cutoffTicks[0], yMax: cutoffTicks[1] };
//     }
    
//     // Fallback for values outside range
//     return { yMin: rawValue, yMax: rawValue };
//   };

//   const initializeChart = (categories, sortedStateIDs, rawYAxisTicks) => {
//     // Create transparent plotBands so that all state categories are visible.
//     const plotBands = categories.map((cat, i) => ({
//       from: i - 0.5,
//       to: i + 0.5,
//       color: "rgba(0,0,0,0)"
//     }));

//     // Format title without event information
//     const formattedTitle = title || `Property ${temporalPropertyIdToShow}`;

//     const options = {
//       // Reduce top spacing so that the title doesn't force extra vertical space.
//       chart: {
//         type: "xrange",
//         marginLeft: 100,
//         marginRight: 30,
//         marginTop: 30, // Increased to match RawDataGraph and give space for custom title
//         spacingTop: 10,
//         spacingBottom: 10,
//         height: 230,
//         animation: false,
//         events: {
//           load: function () {
//             chartRef.current = this;

//             const updateButtonPositions = () => {
//               const chart = chartRef.current;
//               if (!chart || !chart.chartWidth || !chart.renderer) return; // Add safety check for renderer
              
//               const chartWidth = chart.chartWidth;
//               if (!chart.customButtons) {
//                 chart.customButtons = {};

//                 // Add safety check for renderer before creating buttons
//                 if (chart.renderer && chart.renderer.button) {
//                   chart.customButtons.realTimeButton = chart.renderer
//                     .button("Now", chartWidth - 75, 10)
//                     .attr({ zIndex: 3, height: 6 })
//                     .on("click", function () {
//                       isRealTimeRef.current = true;
//                       const xAxis = chart.xAxis[0];
//                       if (xAxis.dataMax) {
//                         const xMax = xAxis.dataMax + 2000;
//                         const xMin = Math.max(0, xMax - 30000);
//                         xAxis.setExtremes(xMin, xMax + 1000, true, true);
//                       }
//                     })
//                     .add();

//                   chart.customButtons.changeViewButton = chart.renderer.button(
//                     showRawDataRef.current ? 'Show Intervals' : 'Show Raw Data',
//                     chartWidth - 195, 10,
//                     function() { // Use the callback parameter instead of .on('click')
//                       const newShowRawData = !showRawDataRef.current;
//                       setShowRawData(newShowRawData);
                      
//                       // Update button text using the button reference
//                       chart.customButtons.changeViewButton.attr({
//                         text: newShowRawData ? 'Show Intervals' : 'Show Raw Data'
//                       });
                      
//                       // Reload series data so raw data is available when switching views.
//                       reloadSeriesData(newShowRawData);
                      
//                       // Adjust raw data y-axis if switching to raw data view
//                       // if (newShowRawData) {
//                       //   setTimeout(() => {
//                       //     adjustRawDataYAxisToShowAllData();
//                       //   }, 100);
//                       // }
//                     },
//                     { width: 100, style: { textAlign: 'center' } },
//                     { width: 100, style: { textAlign: 'center' } }
//                   )
//                     .attr({ zIndex: 3, height: 6 })
//                     .add();
//                 }
//               } else {
//                 if (chart.customButtons.realTimeButton && chart.customButtons.realTimeButton.attr) {
//                   chart.customButtons.realTimeButton.attr({ x: chartWidth - 75 });
//                 }
//                 if (chart.customButtons.changeViewButton && chart.customButtons.changeViewButton.attr) {
//                   chart.customButtons.changeViewButton.attr({
//                     x: chartWidth - 195,
//                     text: showRawDataRef.current ? 'Show Intervals' : 'Show Raw Data',
//                     width: 100
//                   });
//                 }
//               }
//             };

//             // Defer button creation to ensure chart is fully rendered
//             setTimeout(() => {
//               updateButtonPositions();
//             }, 100);

//             // Override the chart's redraw to also update button positions.
//             chartRef.current.redraw = function () {
//               Highcharts.Chart.prototype.redraw.call(this);
//               // Add safety check before calling updateButtonPositions
//               if (chartRef.current && chartRef.current.renderer) {
//                 updateButtonPositions();
//               }
//             };

//             // Debounce the resize handler.
//             resizeHandlerRef.current = debounce(() => {
//               if (chartRef.current && chartRef.current.renderer) {
//                 chartRef.current.reflow();
//                 updateButtonPositions();
//               }
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
//       title: {
//         text: null // Remove Highcharts title, we'll use custom div like RawDataGraph
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
//         {
//           title: { text: "" },
//           categories: categories,
//           reversed: false,
//           visible: false, // Always hide interval y-axis for step 1
//           opposite: false,
//           labels: { align: "right", x: -10, style: { fontSize: "12px" } },
//           lineWidth: 1,
//           min: 0,
//           max: categories.length - 1,
//           plotBands: plotBands
//         },
//         {
//           title: { text: "" },
//           opposite: false,
//           visible: true, // Always show raw data y-axis for step 1
//           labels: { align: "right", x: -10, style: { fontSize: "14px" } },
//           lineWidth: 1,
//           tickPositions: rawYAxisTicks, // Use the cutoff values as y-axis ticks
//           min: rawYAxisTicks && rawYAxisTicks.length > 0 ? rawYAxisTicks[0] : 0,
//           max: rawYAxisTicks && rawYAxisTicks.length > 0 ? rawYAxisTicks[rawYAxisTicks.length - 1] : 150
//         }
//       ],
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
//           type: "xrange",
//           data: [],
//           colorByPoint: true,
//           animation: false,
//           tooltip: { enabled: false, pointFormatter: () => "" },
//           enableMouseTracking: false,
//           borderRadius: 0,
//           zIndex: 2, // Higher z-index to appear on top of raw data
//           pointPadding: 0,
//           groupPadding: 0,
//           grouping: false,
//           visible: true, // Show interval series for step 2
//           yAxis: 1, // Use the same y-axis as raw data (the cutoffs axis)
//           dataLabels: {
//             enabled: false
//           },
//           // Configure pointWidth to be interpreted as axis units
//           pointWidthUnit: 'axis',
//         },
//         {
//           name: "Raw Data",
//           type: "line",
//           data: [],
//           yAxis: 1,
//           color: 'transparent', // Make line color transparent
//           lineWidth: 0, // Remove connecting lines between data points
//           marker: {
//             enabled: true,
//             radius: 3,
//             fillColor: '#B0C4D9' // Keep marker color visible
//           },
//           visible: true, // Always show raw data series for step 1
//           animation: false
//         },
//         {
//           name: "Highlights",
//           type: "xrange",
//           data: [],
//           color: "rgba(103, 136, 168, 0.70)",
//           zIndex: 10,
//           borderWidth: 0,
//           pointWidth: 20,
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

//     chartRef.current = Highcharts.stockChart(graphId, options);
//   };

//   const reloadSeriesData = (showRaw) => {
//     const chart = chartRef.current;
//     if (!chart) return;

//     // Get the latest 120 data points from the data store.
//     const latestData = DataUpdateService.getStoredData(temporalPropertyIdToShow, eventIdRef.current).slice(-120);

//     console.log(`[GraphIntervals] Reloading ${latestData.length} data points for property ${temporalPropertyIdToShow}`);

//     const intervalData = [];
//     const rawData = [];
//     let deletedCount = 0;

//     latestData.forEach((point) => {
//       const stateId = parseInt(point.state_id);
//       const time = point.time * 1000;
//       const rawValue = point.raw_value;
//       const label = stateMapRef.current[stateId] || 'Unknown';
//       const y = Object.keys(stateMapRef.current).indexOf(stateId.toString());
//       const isTransparent = point.transparent || false;
//       const isDeleted = point.deleted || false;

//       if (isDeleted || isTransparent) {
//         deletedCount++;
//       }

//       if (isTransparent || isDeleted) {
//         intervalData.push({
//           x: time,
//           x2: time + 1000,
//           y: null,
//           name: '',
//           color: 'rgba(0,0,0,0)',
//         });
//       } else {
//         // Get the cutoff bin boundaries for this raw value
//         const boundaries = getCutoffBinBoundaries(rawValue, cutoffTicksRef.current);
//         console.log(`Creating interval for rawValue ${rawValue}: boundaries.yMin=${boundaries.yMin}, boundaries.yMax=${boundaries.yMax}`);
        
//         // For xrange: position at center and set pointWidth in axis units
//         const yCenter = (boundaries.yMin + boundaries.yMax) / 2;
//         const intervalHeight = boundaries.yMax - boundaries.yMin;
        
//         console.log(`rawValue: ${rawValue}, bin: [${boundaries.yMin}, ${boundaries.yMax}], center: ${yCenter}, height: ${intervalHeight}`);
        
//         intervalData.push({
//           x: time,
//           x2: time + 1000,
//           y: yCenter, // Position at center of range
//           name: `${label} (${rawValue})`,
//           color: '#E9EEF6',
//           pointWidth: intervalHeight, // Set height based on cutoff range difference
//         });
//       }

//       rawData.push([time, (isTransparent || isDeleted) ? null : rawValue]);
//     });

//     if (deletedCount > 0) {
//       console.log(`[GraphIntervals] Found ${deletedCount} deleted/transparent intervals in stored data for property ${temporalPropertyIdToShow}`);
//     }

//     const intervalSeries = chart.series[0];
//     const rawDataSeries = chart.series[1];

//     intervalSeries.setData(intervalData, false);
//     rawDataSeries.setData(rawData, false);

//     // For step 2: Show both intervals and raw data
//     intervalSeries.setVisible(true, false);
//     rawDataSeries.setVisible(true, false);

//     // For step 2: Hide interval axis, show raw data axis (both series use raw data axis)
//     chart.yAxis[0].update({ visible: false }, false);
//     chart.yAxis[1].update({ visible: true }, false);

//     // Convert pointWidth from axis units to pixels for proper display
//     const yAxis = chart.yAxis[1];
//     const pixelsPerAxisUnit = yAxis.height / (yAxis.max - yAxis.min);
    
//     intervalSeries.points.forEach((point, index) => {
//       if (point.options.pointWidth && typeof point.options.pointWidth === 'number') {
//         const pointWidthInPixels = point.options.pointWidth * pixelsPerAxisUnit;
//         console.log(`Interval ${index}: Converting pointWidth ${point.options.pointWidth} axis units to ${pointWidthInPixels} pixels`);
        
//         // Update the point's graphic with correct pixel height
//         if (point.graphic) {
//           point.graphic.attr({
//             height: pointWidthInPixels
//           });
//         }
//       }
//     });

//     chart.redraw();

//     // Adjust raw data y-axis if switching to raw data view
//     // if (showRaw && rawData.length > 0) {
//     //   setTimeout(() => {
//     //     adjustRawDataYAxisToShowAllData();
//     //   }, 50);
//     // }

//     if (isRealTimeRef.current && intervalData.length > 0) {
//       // For step 2: Use raw data series for real-time view (both series are visible)
//       const activeSeries = rawDataSeries;
//       const lastPoint = activeSeries.points[activeSeries.points.length - 1];
//       if (lastPoint) {
//         chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
//       }
//     }
//   };

//   const populateInitialData = (data) => {
//     data.forEach((point) => updateChart(point, false)); // false = not transparent for initial data
    
//     // Adjust raw data y-axis after populating initial data if raw data view is active
//     // if (showRawDataRef.current) {
//     //   setTimeout(() => {
//     //     adjustRawDataYAxisToShowAllData();
//     //   }, 100);
//     // }
//   };

//   const updateChart = (data, transparent = false) => {
//     const chart = chartRef.current;
//     if (!chart) return;

//     const intervalSeries = chart.series[0];
//     const rawDataSeries = chart.series[1];
//     const stateId = parseInt(data.state_id);
//     const time = data.time * 1000;
//     const label = stateMapRef.current[stateId] || 'Unknown';
//     const y = Object.keys(stateMapRef.current).indexOf(stateId.toString());
//     const rawValue = data.raw_value;
//     const isDeleted = data.deleted || false;
//     const isTransparent = transparent || data.transparent || isDeleted;

//     // if (isDeleted) {
//     //   console.log(`[GraphIntervals] Processing deleted interval for property ${temporalPropertyIdToShow} at time ${data.time}`);
//     // }

//     // Remove any placeholder (should not occur anymore).
//     const placeholderPoint = intervalSeries.points.find((p) => p.y === y && p.x === 0);
//     if (placeholderPoint) {
//       placeholderPoint.remove(false);
//     }

//     if (isTransparent) {
//       // Handle transparent intervals
//       const transparentPoint = {
//         x: time,
//         x2: time + 1000,
//         y: null,
//         name: '',
//         color: 'rgba(0,0,0,0)',
//       };
//       currentIntervalRef.current = intervalSeries.addPoint(
//         transparentPoint,
//         true,
//         intervalSeries.data.length >= 120
//       );
//     } else {
//       // Handle normal intervals with cutoff boundaries
//       const boundaries = getCutoffBinBoundaries(rawValue, cutoffTicksRef.current);
//       const yCenter = (boundaries.yMin + boundaries.yMax) / 2;
//       const intervalHeight = boundaries.yMax - boundaries.yMin;
      
//       const intervalPoint = {
//         x: time,
//         x2: time + 1000,
//         y: yCenter,
//         name: `${label} (${rawValue})`,
//         color: '#E9EEF6',
//         pointWidth: intervalHeight,
//       };
//       currentIntervalRef.current = intervalSeries.addPoint(
//         intervalPoint,
//         true,
//         intervalSeries.data.length >= 120
//       );
//     }

//     // Always add raw data point to maintain timeline continuity
//     // Raw data series needs continuous timeline regardless of view mode
//     const rawPoint = [time, isTransparent ? null : rawValue];
//     rawDataSeries.addPoint(rawPoint, true, rawDataSeries.data.length >= 120);

//     // Adjust raw data y-axis if we have a visible raw value and raw data is currently shown
//     // if (!isTransparent && rawValue !== null && rawValue !== undefined && showRawDataRef.current) {
//     //   setTimeout(() => {
//     //     adjustRawDataYAxisToShowAllData();
//     //   }, 10);
//     // }

//     if (isRealTimeRef.current) {
//     // For step 2: Use raw data series for real-time view (both series are visible)
//     const series = rawDataSeries;
//       const lastPoint = series.points[series.points.length - 1];
//       if (lastPoint) {
//         chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
//       }
//     }
//   };

//   return (
//     <div
//       style={{
//         height: "230px",
//         width: "100%",
//         borderRadius: "4px",
//         padding: "5px",
//         margin: "0",
//         marginBottom: "0px",
//         boxSizing: "border-box",
//         position: "relative" // Add relative positioning for custom title
//       }}
//     >
//       {/* Custom title that matches RawDataGraph styling */}
//       <div
//         style={{
//           position: "absolute",
//           top: "20px",
//           left: "15px",
//           fontSize: "16px",
//           fontWeight: "bold",
//           color: "#333",
//           whiteSpace: "normal",
//           width: "80%",
//           zIndex: 10 // Ensure title appears above chart
//         }}
//       >
//         {title || `Property ${temporalPropertyIdToShow}`}
//       </div>
      
//       <div
//         id={graphId}
//         style={{
//           height: "100%",
//           width: "100%"
//         }}
//       ></div>
//     </div>
//   );
// }


import { useState, useEffect, useRef, useCallback } from "react";
import Highcharts from "highcharts/highstock";
import xrange from "highcharts/modules/xrange";
import DataManagementService from "../dataService/DataManagementService";
import TimingService from "../dataService/TimingService";
import { getXAxisLabelsConfig } from "../../utils/xAxisFormatter"; 

xrange(Highcharts);

// Simple debounce helper.
const debounce = (func, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

export default function GraphIntervalsOverlay({
  temporalPropertyIdToShow,
  graphId,
  DataUpdateService,
  title,
  states,
  initialData,
  onVisibilityChange,
  isVisible,
  eventId,
  highlightedIntervals = []
}) {
  const [showRawData, setShowRawData] = useState(true);
  const showRawDataRef = useRef(showRawData);
  const chartRef = useRef(null);
  const stateMapRef = useRef({});
  const currentIntervalRef = useRef(null);
  const isRealTimeRef = useRef(true);
  const wasVisible = useRef(false);
  const resizeHandlerRef = useRef(null);
  const eventIdRef = useRef(eventId);
  const lastDataTimeRef = useRef(null);           // In milliseconds
  const lastDataReceivedTimeRef = useRef(null);   // In milliseconds
  const timingUnsubscribeRef = useRef(null);      // For centralized timing service
  const cutoffTicksRef = useRef([]);              // Store cutoff ticks for interval height calculations
  const scaledBinMapRef = useRef({});             // Store scaled bin positions and heights
  const actualYAxisHeightRef = useRef(150);       // Store actual y-axis height in pixels

  useEffect(() => {
    showRawDataRef.current = showRawData;
  }, [showRawData]);

  useEffect(() => {
    eventIdRef.current = eventId;
  }, [eventId]);

  useEffect(() => {
    if (states && states.length > 0) {
      stateMapRef.current = states.reduce((map, state) => {
        map[state.StateID] = state.BinLabel;
        return map;
      }, {});

      const sortedStateIDs = Object.keys(stateMapRef.current).sort((a, b) => parseInt(a) - parseInt(b));
      const categories = sortedStateIDs.map(id => stateMapRef.current[id]);

      //  Fetch dynamic y-axis ticks
      DataManagementService.fetchTemporalPropertyCutoffs(temporalPropertyIdToShow, eventId).then((cutoffsData) => {
        let tickValues = [];
        if (cutoffsData && Array.isArray(cutoffsData) && cutoffsData.length > 0) {
          const cutoffSet = new Set();
          cutoffsData.forEach((cutoff) => {
            const possibleLowKeys = ['BinLow', 'binLow', 'low', 'min', 'start'];
            const possibleHighKeys = ['BinHigh', 'binHigh', 'high', 'max', 'end'];
            possibleLowKeys.forEach(key => {
              if (cutoff[key] !== undefined && cutoff[key] !== null) {
                const numValue = Number(cutoff[key]);
                if (!isNaN(numValue)) cutoffSet.add(numValue);
              }
            });
            possibleHighKeys.forEach(key => {
              if (cutoff[key] !== undefined && cutoff[key] !== null) {
                const numValue = Number(cutoff[key]);
                if (!isNaN(numValue)) cutoffSet.add(numValue);
              }
            });
            if (typeof cutoff === 'number' || (!isNaN(Number(cutoff)))) {
              cutoffSet.add(Number(cutoff));
            }
          });
          tickValues = Array.from(cutoffSet).sort((a, b) => a - b);
        }

        if (tickValues && tickValues.length > 1) {
          cutoffTicksRef.current = tickValues;
          // Calculate scaled bin positions - will be recalculated after chart loads with actual height
          scaledBinMapRef.current = calculateScaledBinPositions(tickValues, 150); // Initial estimate
          initializeChart(categories, sortedStateIDs, tickValues);
        } else {
          // Fallback
          cutoffTicksRef.current = [0, 50, 100, 150];
          scaledBinMapRef.current = calculateScaledBinPositions([0, 50, 100, 150], 150); // Initial estimate
          initializeChart(categories, sortedStateIDs, [0, 50, 100, 150]);
        }

        // Initialize time references
        lastDataTimeRef.current = TimingService.getCurrentTimestamp();
        lastDataReceivedTimeRef.current = TimingService.getCurrentTimestamp();
        isRealTimeRef.current = true;

        // Initial data will be populated after chart loads with actual y-axis height
        // (see chart.events.load handler)

        // subscribe to centralized timing
        if (timingUnsubscribeRef.current) {
          timingUnsubscribeRef.current();
        }
        timingUnsubscribeRef.current = TimingService.subscribeToTimeAdvance((timestamp) => {
          lastDataTimeRef.current = timestamp;
          if (chartRef.current && isVisible) {
            handleNoNewData(timestamp);
          }
        });
      });
    }

    return () => {
      if (timingUnsubscribeRef.current) {
        timingUnsubscribeRef.current();
        timingUnsubscribeRef.current = null;
      }
      if (chartRef.current) {
        if (resizeHandlerRef.current) {
          window.removeEventListener("resize", resizeHandlerRef.current);
        }
        chartRef.current.destroy();
      }
    };
  }, [states, initialData, eventId, isVisible]);

  useEffect(() => {
    if (onVisibilityChange && isVisible && !wasVisible.current) {
      onVisibilityChange();
      wasVisible.current = true;
      if (chartRef.current) {
        reloadSeriesData(showRawDataRef.current);
      }
    }
  }, [onVisibilityChange, isVisible, temporalPropertyIdToShow]);

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      const last = initialData[initialData.length - 1];
      if (last && last.time) {
        lastDataTimeRef.current = last.time * 1000;
      }
    }
  }, [initialData]);

  const removeIntervalsInTimeRange = useCallback((startTime, endTime) => {
    const chart = chartRef.current;
    if (!chart) return;

    const intervalSeries = chart.series[0];
    const rawDataSeries = chart.series[1];

    let intervalsModified = 0;
    let rawDataModified = 0;

    intervalSeries.data.forEach((point) => {
      const intervalStart = point.x;
      const intervalEnd = point.x2;
      const intervalCenter = (intervalStart + intervalEnd) / 2;
      const isCompletelyContained = intervalStart >= startTime && intervalEnd <= endTime;
      const isCenterWithinRange = intervalCenter >= startTime && intervalCenter <= endTime;
      if (isCompletelyContained || isCenterWithinRange) {
        point.update({
          color: 'rgba(0,0,0,0)',
          name: '',
        }, false);
        intervalsModified++;
      }
    });

    rawDataSeries.data.forEach((point) => {
      const pointTime = point.x;
      if (pointTime >= startTime && pointTime <= endTime) {
        point.update({ y: null }, false);
        rawDataModified++;
      }
    });

    intervalSeries.setVisible(true, false);
    rawDataSeries.setVisible(true, false);
    chart.yAxis[0].update({ visible: false }, false);
    chart.yAxis[1].update({ visible: true }, false);
    chart.redraw();

    if (isRealTimeRef.current && intervalSeries.data.length > 0) {
      const lastPoint = intervalSeries.data[intervalSeries.data.length - 1];
      chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
    }
  }, [temporalPropertyIdToShow]);

  useEffect(() => {
    const updateData = (filteredData, intervalsToFix) => {
      if (filteredData && filteredData.time) {
        const timestampMs = filteredData.time * 1000;
        lastDataReceivedTimeRef.current = timestampMs;
        lastDataTimeRef.current = timestampMs;
      }
      if (chartRef.current && isVisible) {
        if (intervalsToFix && Array.isArray(intervalsToFix)) {
          const [startTime, endTime] = intervalsToFix;
          removeIntervalsInTimeRange(startTime * 1000, endTime * 1000);
        }
        updateChart(filteredData, false);
      }
    };

    if (isVisible) {
      DataUpdateService.addListener(temporalPropertyIdToShow, updateData, eventId);
    } else {
      DataUpdateService.removeListener(temporalPropertyIdToShow, updateData, eventId);
    }

    return () => {
      DataUpdateService.removeListener(temporalPropertyIdToShow, updateData, eventId);
    };
  }, [isVisible, temporalPropertyIdToShow, DataUpdateService, eventId, removeIntervalsInTimeRange]);

  useEffect(() => {
    const handleTimestamp = (timestamp, entity_data, intervalsToFix) => {
      const timestampMs = timestamp * 1000;
      lastDataReceivedTimeRef.current = timestampMs;
      lastDataTimeRef.current = timestampMs;

      if (chartRef.current && isVisible) {
        if (intervalsToFix && intervalsToFix[temporalPropertyIdToShow] && Array.isArray(intervalsToFix[temporalPropertyIdToShow])) {
          const [startTime, endTime] = intervalsToFix[temporalPropertyIdToShow];
          removeIntervalsInTimeRange(startTime * 1000, endTime * 1000);
        }
        const hasDataForProperty = entity_data[temporalPropertyIdToShow];
        if (!hasDataForProperty) {
          const transparentData = {
            time: timestamp,
            state_id: Object.keys(stateMapRef.current)[0] || 0,
            raw_value: 0,
            transparent: true
          };
          updateChart(transparentData, true);
        }
      }
    };

    if (isVisible) {
      DataUpdateService.addTimestampListener(eventId, handleTimestamp);
    } else {
      DataUpdateService.removeTimestampListener(eventId, handleTimestamp);
    }

    return () => {
      DataUpdateService.removeTimestampListener(eventId, handleTimestamp);
    };
  }, [isVisible, eventId, temporalPropertyIdToShow, removeIntervalsInTimeRange]);

  useEffect(() => {
    if (isVisible && chartRef.current) {
      const realTimeButton = chartRef.current.customButtons?.realTimeButton;
      if (realTimeButton && realTimeButton.element) {
        realTimeButton.element.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      }
    }
  }, [isVisible]);

  useEffect(() => {
    let intervalId = null;
    function updateHighlightSeries() {
      if (!chartRef.current) return;
      let highlightSeries = chartRef.current.series.find(s => s.name === 'Highlights');
      if (!highlightSeries) return;

      // Always use interval highlighting (no raw data highlighting)
      const intervalSeries = chartRef.current.series[0];
      if (!intervalSeries) return;

      const now = lastDataTimeRef.current + 1000;
      const highlightData = [];

      (highlightedIntervals || []).forEach(interval => {
        const intervalStart = interval.start;
        const intervalEnd = interval.end || now;
        
        // Find all interval points that overlap with this highlighted interval
        intervalSeries.points.forEach((point) => {
          const pointStart = point.x;
          const pointEnd = point.x2;
          
          // Check if this interval point overlaps with the highlighted interval
          const overlaps = (pointStart <= intervalEnd && pointEnd >= intervalStart);
          
          if (overlaps && point.y !== null && point.options.color !== 'rgba(0,0,0,0)') {
            // Get the raw value from the interval's name (format: "Label (rawValue)")
            const nameMatch = point.name?.match(/\((\d+(?:\.\d+)?)\)/);
            let rawValue = null;
            
            if (nameMatch) {
              rawValue = parseFloat(nameMatch[1]);
            }
            
            // If we found a raw value, use scaled bin properties for exact height
            if (rawValue !== null) {
              const binProps = getScaledBinProperties(rawValue, cutoffTicksRef.current, scaledBinMapRef.current);
              
              // Calculate the overlap region
              const highlightStart = Math.max(pointStart, intervalStart);
              const highlightEnd = Math.min(pointEnd, intervalEnd);
              
              highlightData.push({
                x: highlightStart,
                x2: highlightEnd,
                y: binProps.yCenter, // Use same y position as the interval
                name: '',
                color: 'rgba(103, 136, 168, 0.70)',
                pointWidth: binProps.height, // Use same height as the interval
              });
            }
          }
        });
      });

      highlightSeries.update({
        type: 'xrange',
        yAxis: 1, // Use scaled pixel axis (same as intervals)
        data: highlightData,
        color: "rgba(103, 136, 168, 0.70)",
        borderRadius: 0,
        enableMouseTracking: false,
        showInLegend: false,
        animation: false
      }, false);

      chartRef.current.redraw();
    }

    if (highlightedIntervals && highlightedIntervals.length > 0) {
      intervalId = setInterval(updateHighlightSeries, 1000);
      updateHighlightSeries();
    } else if (chartRef.current) {
      let highlightSeries = chartRef.current.series.find(s => s.name === 'Highlights');
      if (highlightSeries) {
        highlightSeries.setData([], false);
        chartRef.current.redraw();
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [highlightedIntervals, states, showRawData]);

  const handleNoNewData = (timestamp) => {
    const chart = chartRef.current;
    if (!chart) return;

    const intervalSeries = chart.series[0];
    const rawDataSeries = chart.series[1];

    const transparentPoint = {
      x: timestamp,
      x2: timestamp + 1000,
      y: null,
      name: '',
      color: 'rgba(0, 0, 0, 0)',
    };
    intervalSeries.addPoint(transparentPoint, false);
    rawDataSeries.addPoint([timestamp, null], false);

    chart.redraw();

    if (isRealTimeRef.current) {
      const activeSeries = rawDataSeries;
      const lastPoint = activeSeries.points[activeSeries.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  // Helper: Calculate scaled bin positions based on proportional sizing
  const calculateScaledBinPositions = (cutoffTicks, chartHeight = 230) => {
    if (!cutoffTicks || cutoffTicks.length < 2) {
      return {};
    }

    // Calculate bin sizes
    const bins = [];
    for (let i = 0; i < cutoffTicks.length - 1; i++) {
      bins.push({
        index: i,
        rawMin: cutoffTicks[i],
        rawMax: cutoffTicks[i + 1],
        size: cutoffTicks[i + 1] - cutoffTicks[i]
      });
    }

    // Calculate total size
    const totalSize = bins.reduce((sum, bin) => sum + bin.size, 0);

    // Calculate scaled positions and heights
    let cumulativePosition = 0;
    const scaledBinMap = {};

    bins.forEach((bin) => {
      const proportionalHeight = (bin.size / totalSize) * chartHeight;
      const scaledMin = cumulativePosition;
      const scaledMax = cumulativePosition + proportionalHeight;
      const scaledCenter = (scaledMin + scaledMax) / 2;

      // Map by bin index
      scaledBinMap[bin.index] = {
        rawMin: bin.rawMin,
        rawMax: bin.rawMax,
        scaledMin: scaledMin,
        scaledMax: scaledMax,
        scaledCenter: scaledCenter,
        scaledHeight: proportionalHeight * 0.8 // 80% to fit more exactly in cutoffs
      };

      cumulativePosition += proportionalHeight;
    });

    return scaledBinMap;
  };

  // Helper: Get scaled bin properties for a raw value
  // Returns scaled positions in pixel space for the interval series
  const getScaledBinProperties = (rawValue, cutoffTicks, scaledBinMap) => {
    if (!cutoffTicks || cutoffTicks.length < 2 || !scaledBinMap) {
      return { yCenter: 0, height: 20 };
    }

    // Find which bin the raw value belongs to
    for (let i = 0; i < cutoffTicks.length - 1; i++) {
      const binLow = cutoffTicks[i];
      const binHigh = cutoffTicks[i + 1];
      
      if (rawValue >= binLow && rawValue < binHigh) {
        const binInfo = scaledBinMap[i];
        return {
          yCenter: binInfo.scaledCenter,
          height: binInfo.scaledHeight,
          rawMin: binInfo.rawMin,
          rawMax: binInfo.rawMax
        };
      }
    }
    
    // Handle edge cases
    const lastIndex = cutoffTicks.length - 2; // Last bin index
    if (rawValue >= cutoffTicks[cutoffTicks.length - 1]) {
      const binInfo = scaledBinMap[lastIndex];
      return {
        yCenter: binInfo.scaledCenter,
        height: binInfo.scaledHeight,
        rawMin: binInfo.rawMin,
        rawMax: binInfo.rawMax
      };
    }
    
    // Value below lowest cutoff
    const binInfo = scaledBinMap[0];
    return {
      yCenter: binInfo.scaledCenter,
      height: binInfo.scaledHeight,
      rawMin: binInfo.rawMin,
      rawMax: binInfo.rawMax
    };
  };

  const initializeChart = (categories, sortedStateIDs, rawYAxisTicks) => {
    const plotBands = categories.map((cat, i) => ({
      from: i - 0.5,
      to: i + 0.5,
      color: "rgba(0,0,0,0)"
    }));

    const formattedTitle = title || `Property ${temporalPropertyIdToShow}`;

    const options = {
      chart: {
        type: "xrange",
        marginLeft: 100,
        marginRight: 30,
        marginTop: 30,
        spacingTop: 10,
        spacingBottom: 10,
        height: 230,
        animation: false,
        events: {
          load: function () {
            chartRef.current = this;

            // Store actual y-axis height and recalculate scaled bins
            const actualYAxisHeight = this.yAxis[1].height;
            console.log(`[GraphIntervalsOverlay] Actual y-axis height: ${actualYAxisHeight}px`);
            actualYAxisHeightRef.current = actualYAxisHeight;
            scaledBinMapRef.current = calculateScaledBinPositions(cutoffTicksRef.current, actualYAxisHeight);

            // Update scaled y-axis (yAxis[1]) with scaled tick positions
            const scaledTickPositions = [];
            const scaledTickLabels = {};
            
            Object.keys(scaledBinMapRef.current).forEach((binIndex) => {
              const bin = scaledBinMapRef.current[binIndex];
              if (!scaledTickPositions.includes(bin.scaledMin)) {
                scaledTickPositions.push(bin.scaledMin);
                scaledTickLabels[bin.scaledMin] = bin.rawMin;
              }
              if (!scaledTickPositions.includes(bin.scaledMax)) {
                scaledTickPositions.push(bin.scaledMax);
                scaledTickLabels[bin.scaledMax] = bin.rawMax;
              }
            });

            this.yAxis[1].update({
              tickPositions: scaledTickPositions,
              min: 0,
              max: actualYAxisHeight,
              labels: {
                align: "right",
                x: -10,
                style: { fontSize: "14px" },
                formatter: function() {
                  const value = scaledTickLabels[this.value] !== undefined ? scaledTickLabels[this.value] : this.value;
                  return Number(value).toFixed(1);
                }
              }
            }, false);

            // Reload initial data with recalculated scaled bins
            if (initialData && initialData.length > 0) {
              const recentData = initialData.slice(-120);
              recentData.forEach((point) => updateChart(point, false));
            }

            const updateButtonPositions = () => {
              const chart = chartRef.current;
              if (!chart || !chart.chartWidth || !chart.renderer) return;
              const chartWidth = chart.chartWidth;
              if (!chart.customButtons) {
                chart.customButtons = {};
                if (chart.renderer && chart.renderer.button) {
                  chart.customButtons.realTimeButton = chart.renderer
                    .button("Now", chartWidth - 75, 10)
                    .attr({ zIndex: 3, height: 6 })
                    .on("click", function () {
                      isRealTimeRef.current = true;
                      const xAxis = chart.xAxis[0];
                      if (xAxis.dataMax) {
                        const xMax = xAxis.dataMax + 2000;
                        const xMin = Math.max(0, xMax - 30000);
                        xAxis.setExtremes(xMin, xMax + 1000, true, true);
                      }
                    })
                    .add();

                  chart.customButtons.changeViewButton = chart.renderer.button(
                    showRawDataRef.current ? 'Hide Raw Data' : 'Show Raw Data',
                    chartWidth - 195, 10,
                    function() {
                      const newShowRawData = !showRawDataRef.current;
                      setShowRawData(newShowRawData);
                      
                      // Toggle raw data series visibility
                      const rawDataSeries = chart.series[1];
                      if (rawDataSeries) {
                        rawDataSeries.setVisible(newShowRawData, true);
                      }
                      
                      // Update button text
                      chart.customButtons.changeViewButton.attr({
                        text: newShowRawData ? 'Hide Raw Data' : 'Show Raw Data'
                      });
                    },
                    { width: 100, style: { textAlign: 'center' } },
                    { width: 100, style: { textAlign: 'center' } }
                  )
                    .attr({ zIndex: 3, height: 6 })
                    .add();
                }
              } else {
                if (chart.customButtons.realTimeButton && chart.customButtons.realTimeButton.attr) {
                  chart.customButtons.realTimeButton.attr({ x: chartWidth - 75 });
                }
                if (chart.customButtons.changeViewButton && chart.customButtons.changeViewButton.attr) {
                  chart.customButtons.changeViewButton.attr({
                    x: chartWidth - 195,
                    text: showRawDataRef.current ? 'Hide Raw Data' : 'Show Raw Data',
                    width: 100
                  });
                }
              }
            };

            setTimeout(() => { 
              updateButtonPositions();
              
              // Automatically click "Now" button to show most recent data
              setTimeout(() => {
                if (chartRef.current && chartRef.current.customButtons && chartRef.current.customButtons.realTimeButton) {
                  const realTimeButton = chartRef.current.customButtons.realTimeButton;
                  if (realTimeButton.element) {
                    realTimeButton.element.dispatchEvent(
                      new MouseEvent("click", { bubbles: true, cancelable: true })
                    );
                  }
                }
              }, 200);
            }, 100);

            chartRef.current.redraw = function () {
              Highcharts.Chart.prototype.redraw.call(this);
              if (chartRef.current && chartRef.current.renderer) {
                updateButtonPositions();
              }
            };

            resizeHandlerRef.current = debounce(() => {
              if (chartRef.current && chartRef.current.renderer) {
                chartRef.current.reflow();
                updateButtonPositions();
              }
            }, 200);
            window.addEventListener("resize", resizeHandlerRef.current);
          },
          selection: function (event) {
            if (event.xAxis) {
              isRealTimeRef.current = false;
            }
            return true;
          }
        }
      },
      accessibility: { enabled: false },
      title: { text: null },
      credits: { enabled: false },
      plotOptions: {
        series: {
          states: {
            inactive: {
              opacity: 1 // Keep all series fully visible when hovering
            }
          }
        }
      },
      xAxis: [
        {
          type: "datetime",
          title: { text: "" },
          min: 0,
          max: 1,
          animation: false,
          labels: getXAxisLabelsConfig(),
          events: {
            setExtremes: function (e) {
              if (e.trigger !== "syncExtremes") {
                isRealTimeRef.current = false;
              }
            }
          }
        }
      ],
      yAxis: [
        {
          title: { text: "" },
          categories: categories,
          reversed: false,
          visible: false, // keep hidden
          opposite: false,
          labels: { align: "right", x: -10, style: { fontSize: "12px" } },
          lineWidth: 1,
          min: 0,
          max: categories.length - 1,
          plotBands: plotBands
        },
        {
          // Y-axis for INTERVALS - uses scaled pixel positions
          title: { text: "" },
          opposite: false,
          visible: true,
          labels: { 
            align: "right", 
            x: -10, 
            style: { fontSize: "14px" },
            formatter: function() {
              // Show raw cutoff values as labels
              const rawMin = rawYAxisTicks[0];
              const rawMax = rawYAxisTicks[rawYAxisTicks.length - 1];
              const rawRange = rawMax - rawMin;
              const rawValue = rawMin + (this.value / 150) * rawRange;
              return Number(rawValue).toFixed(1);
            }
          },
          lineWidth: 1,
          min: 0,
          max: 150 // Scaled pixel space, will be updated on load
        },
        {
          // Y-axis for RAW DATA - uses actual raw values (original behavior)
          title: { text: "" },
          opposite: false,
          visible: false, // Hide this axis, use axis 1's labels
          labels: { 
            align: "right", 
            x: -10, 
            style: { fontSize: "14px" },
            formatter: function() {
              return Number(this.value).toFixed(1);
            }
          },
          lineWidth: 1,
          tickPositions: rawYAxisTicks, // use real cutoffs as ticks
          min: rawYAxisTicks && rawYAxisTicks.length > 0 ? rawYAxisTicks[0] : 0,
          max: rawYAxisTicks && rawYAxisTicks.length > 0 ? rawYAxisTicks[rawYAxisTicks.length - 1] : 150
        }
      ],
      rangeSelector: {
        enabled: true,
        buttons: [
          { count: 30, type: "second", text: "30s" },
          { count: 1, type: "minute", text: "1m" },
          { type: "all", text: "All" }
        ],
        inputEnabled: false,
        selected: 0
      },
      navigator: { enabled: false },
      scrollbar: { enabled: true },
      series: [
        {
          name: "Intervals",
          type: "xrange",
          data: [],
          colorByPoint: true,
          animation: false,
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
          borderRadius: 0,
          zIndex: 1, // Background layer
          pointPadding: 0,
          groupPadding: 0,
          grouping: false,
          visible: true,
          yAxis: 1, // Uses scaled pixel axis
          dataLabels: { enabled: false },
          states: {
            inactive: {
              opacity: 1 // Keep intervals fully visible when other series are hovered
            }
          },
          // pointWidth is in pixels from scaled proportional sizing
        },
        {
          name: "Raw Data",
          type: "line",
          data: [],
          yAxis: 2, // Uses actual raw value axis
          color: 'transparent',
          lineWidth: 0,
          marker: {
            enabled: true,
            radius: 3,
            fillColor: '#B0C4D9'
          },
          visible: true, // Start visible by default, toggle with button
          animation: false,
          zIndex: 5, // On top of intervals
          tooltip: {
            enabled: true,
            headerFormat: '',
            pointFormatter: function() {
              const datasetName = sessionStorage.getItem("dataset_name");
              const isFallsDataset = datasetName === "Falls";
              
              let timeLabel;
              if (isFallsDataset) {
                const ts = Math.round(this.x / 1000);
                timeLabel = `${ts}`;
              } else {
                const s = Math.round(this.x / 1000);
                const mm = String(Math.floor(s / 60)).padStart(2, "0");
                const ss = String(s % 60).padStart(2, "0");
                timeLabel = `${mm}:${ss}`;
              }
              
              return `<b>Value: ${this.y}</b><br/>${timeLabel}`;
            }
          },
          enableMouseTracking: true,
          states: {
            hover: {
              enabled: true,
              lineWidthPlus: 0,
              marker: {
                radius: 5,
                fillColor: '#6788A8'
              }
            }
          }
        },
        {
          name: "Highlights",
          type: "xrange",
          data: [],
          color: "rgba(103, 136, 168, 0.70)",
          yAxis: 1, // Use scaled pixel axis (same as intervals)
          zIndex: 10,
          borderWidth: 0,
          pointWidth: 20,
          enableMouseTracking: false,
          showInLegend: false,
          animation: false,
          pointPadding: 0,
          groupPadding: 0,
          grouping: false,
          borderRadius: 0,
        }
      ]
    };

    chartRef.current = Highcharts.stockChart(graphId, options);
  };

  const reloadSeriesData = (showRaw) => {
    const chart = chartRef.current;
    if (!chart) return;

    const latestData = DataUpdateService.getStoredData(temporalPropertyIdToShow, eventIdRef.current).slice(-120);

    const intervalData = [];
    const rawData = [];
    let deletedCount = 0;

    latestData.forEach((point) => {
      const stateId = parseInt(point.state_id);
      const time = point.time * 1000;
      const rawValue = point.raw_value;
      const label = stateMapRef.current[stateId] || 'Unknown';
      const isTransparent = point.transparent || false;
      const isDeleted = point.deleted || false;

      if (isDeleted || isTransparent) {
        deletedCount++;
      }

      if (isTransparent || isDeleted) {
        intervalData.push({
          x: time,
          x2: time + 1000,
          y: null,
          name: '',
          color: 'rgba(0,0,0,0)',
        });
      } else {
        // Use scaled bin properties for proportional sizing
        const binProps = getScaledBinProperties(rawValue, cutoffTicksRef.current, scaledBinMapRef.current);

        intervalData.push({
          x: time,
          x2: time + 1000,
          y: binProps.yCenter,
          name: `${label} (${rawValue})`,
          color: '#E9EEF6',
          pointWidth: binProps.height, // already in pixels
        });
      }

      rawData.push([time, (isTransparent || isDeleted) ? null : rawValue]);
    });

    const intervalSeries = chart.series[0];
    const rawDataSeries = chart.series[1];

    intervalSeries.setData(intervalData, false);
    rawDataSeries.setData(rawData, false);

    // Intervals always visible, raw data controlled by button
    intervalSeries.setVisible(true, false);
    rawDataSeries.setVisible(showRawDataRef.current, false);

    // y-axes visibility
    chart.yAxis[0].update({ visible: false }, false);
    chart.yAxis[1].update({ visible: true }, false);
    chart.yAxis[2].update({ visible: false }, false);

    chart.redraw();

    if (isRealTimeRef.current && intervalData.length > 0) {
      const activeSeries = rawDataSeries;
      const lastPoint = activeSeries.points[activeSeries.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  const populateInitialData = (data) => {
    data.forEach((point) => updateChart(point, false));
  };

  const updateChart = (data, transparent = false) => {
    const chart = chartRef.current;
    if (!chart) return;

    const intervalSeries = chart.series[0];
    const rawDataSeries = chart.series[1];
    const stateId = parseInt(data.state_id);
    const time = data.time * 1000;
    const label = stateMapRef.current[stateId] || 'Unknown';
    const rawValue = data.raw_value;
    const isDeleted = data.deleted || false;
    const isTransparent = transparent || data.transparent || isDeleted;

    const placeholderPoint = intervalSeries.points.find((p) => p.y === 0 && p.x === 0);
    if (placeholderPoint) {
      placeholderPoint.remove(false);
    }

    if (isTransparent) {
      const transparentPoint = {
        x: time,
        x2: time + 1000,
        y: null,
        name: '',
        color: 'rgba(0,0,0,0)',
      };
      currentIntervalRef.current = intervalSeries.addPoint(
        transparentPoint,
        false,
        intervalSeries.data.length >= 120
      );
    } else {
      // Use scaled bin properties for proportional sizing
      const binProps = getScaledBinProperties(rawValue, cutoffTicksRef.current, scaledBinMapRef.current);

      const intervalPoint = {
        x: time,
        x2: time + 1000,
        y: binProps.yCenter,
        name: `${label} (${rawValue})`,
        color: '#E9EEF6',
        pointWidth: binProps.height, // already in pixels
      };
      currentIntervalRef.current = intervalSeries.addPoint(
        intervalPoint,
        false,
        intervalSeries.data.length >= 120
      );
    }

    const rawPoint = [time, isTransparent ? null : rawValue];
    rawDataSeries.addPoint(rawPoint, false, rawDataSeries.data.length >= 120);

    // Redraw after both points are added
    chart.redraw();

    if (isRealTimeRef.current) {
      const series = rawDataSeries;
      const lastPoint = series.points[series.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  return (
    <div
      style={{
        height: "230px",
        width: "100%",
        borderRadius: "4px",
        padding: "5px",
        margin: "0",
        marginBottom: "0px",
        boxSizing: "border-box",
        position: "relative"
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "15px",
          fontSize: "16px",
          fontWeight: "bold",
          color: "#333",
          whiteSpace: "normal",
          width: "80%",
          zIndex: 10
        }}
      >
        {title || `Property ${temporalPropertyIdToShow}`}
      </div>

      <div id={graphId} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

