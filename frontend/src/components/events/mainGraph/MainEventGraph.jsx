import React, { useState, useEffect, useRef } from 'react';
import Highcharts from 'highcharts/highstock';
import xrange from 'highcharts/modules/xrange';
import DataManagementService from '../../dataService/DataManagementService';
import TimingService from '../../dataService/TimingService';
import HorizontalRefLine from './HorizontalRefLine';
import RightEdgeLine from './RightEdgeLine';
import ProbabilityBox from './RightEdgeProbBox';
import { getXAxisLabelsConfig } from '../../../utils/xAxisFormatter';


const getShowRightEdgeAids = () =>
  (sessionStorage.getItem("showRightEdgeAids") || "on") === "on";

xrange(Highcharts);

const PROB_THRESHOLD = 0.6;

// Height calculation constants for consistent sizing across all graphs
const CHART_BASE_HEIGHT = 120; // Base height for chart structure (axes, margins, etc.)
const HEIGHT_PER_PATTERN = 30;  // Height allocated per pattern row
const MAX_CHART_HEIGHT = 450;   // Maximum chart height
const MIN_CHART_HEIGHT = 150;   // Minimum chart height
const INTERVAL_HEIGHT_RATIO = 0.6; // Ratio of available space that intervals should occupy

// Calculate chart height based on number of rows (patterns + event row)
const calculateChartHeight = (rowCount) => {
  const calculatedHeight = CHART_BASE_HEIGHT + (rowCount * HEIGHT_PER_PATTERN);
  return Math.min(MAX_CHART_HEIGHT, Math.max(MIN_CHART_HEIGHT, calculatedHeight));
};

const formatEventLabel = (title, eventId) =>
  (title || `Event ${eventId}`).replace(/_/g, ' ');

const EVENT_ACTIVE_COLOR = '#ebb7b7';
const EVENT_OCCURRED_COLOR = 'rgb(150, 0, 0)';
const EVENT_ROW_INDEX = 0;
const toPatternRowIndex = (patternIndex) => patternIndex + 1;

// Calculate consistent interval height (pointWidth) based on available space
const calculateIntervalHeight = (patternCount, chartHeight) => {
  // Calculate available space for patterns (chart height minus margins/axes/controls)
  const availablePatternSpace = chartHeight - 120; // Reserve space for margins, axes, controls
  const spacePerPattern = availablePatternSpace / patternCount;
  // Use a ratio of available space to ensure consistent visual appearance
  return Math.max(15, Math.min(25, spacePerPattern * INTERVAL_HEIGHT_RATIO));
};

export default function MainEventGraph({ eventId, eventTitle, graphId, webSocketService,  probability_graph, tte_graph, isEventActive = false, isEventOccurred = false }) {
  const chartRef = useRef(null);

  // Object to track open intervals per pattern.
  // Structure: { [patternId]: [ { id, point, startTime, open }, ... ] }
  const openIntervalsRef = useRef({});
  const eventOccurrenceRef = useRef(null); // { point, open }

  // Real-time and timing references.
  const isRealTimeRef = useRef(true);
  const lastDataTimeRef = useRef(null);           // In milliseconds
  const lastDataReceivedTimeRef = useRef(null);   // In milliseconds

  const [eventPatterns, setEventPatterns] = useState([]);
  const timingUnsubscribeRef = useRef(null);

  const [patternProbs, setPatternProbs] = useState({});   // { patternId : prob }
  const topPatternIdRef           = useRef(null);         // keep last "winner"
  const isEventActiveRef = useRef(isEventActive);

  const eventRowIndex = EVENT_ROW_INDEX;
  const totalRowCount = eventPatterns.length + 1;
  const eventLabel = formatEventLabel(eventTitle, eventId);

  // Calculate chart height based on patterns plus the event row
  const chartHeight = calculateChartHeight(totalRowCount);

  useEffect(() => {
    isEventActiveRef.current = isEventActive;
  }, [isEventActive]);

  // Calculate dynamic margin right based on webpage width, capped at 180px
  const dynamicMarginRight = Math.min(180, Math.max(50, window.innerWidth * 0.12));

  // Define a dummy toggleRelatedGraphs to prevent errors.
  const toggleRelatedGraphs = () => {
    console.log("toggleRelatedGraphs is not implemented in MainEventGraph.");
  };

  // Fetch event patterns from the API.
  useEffect(() => {
    const fetchEventPatterns = async () => {
      try {
        if (eventId !== null && eventId !== 'main') {
          // Use DataManagementService to fetch event patterns
          const { formatted: patternsArray } = await DataManagementService.fetchEventPatterns(eventId);
          setEventPatterns(patternsArray);

          // Initialize the intervals tracking structure.
          const intervalsObj = {};
          patternsArray.forEach((p) => {
            intervalsObj[p.id] = [];
          });
          openIntervalsRef.current = intervalsObj;
        }
      } catch (error) {
        console.error('Error fetching event patterns:', error);
      }
    };

    fetchEventPatterns();
  }, [eventId]);

  // Set up chart and real-time listeners.
  useEffect(() => {
    const cleanupFns = [];

    if (eventPatterns.length === 0) return;

    // 1) Build the chart.
    initializeChart();

    // 2) Initialize time references using centralized timing service
    lastDataTimeRef.current = TimingService.getCurrentTimestamp();
    lastDataReceivedTimeRef.current = TimingService.getCurrentTimestamp();

    // 3) Ensure we start in real-time mode with 30s window
    isRealTimeRef.current = true;

    const patternIds = eventPatterns.map((p) => p.id);

    // Updated data callback: now accepts a third parameter for event_patterns.
    const updateData = (_data, timestamp, eventPatternsData) => {
      if (chartRef.current) {
        const timestampMs = timestamp * 1000;  // Convert to milliseconds
        lastDataReceivedTimeRef.current = timestampMs;
        lastDataTimeRef.current = timestampMs;

        // Always process event patterns data if available
        if (eventPatternsData && Object.keys(eventPatternsData).length > 0) {
          processEventPatterns(eventPatternsData);
        }

        // Only handle no data if main data is empty
        if (!Object.keys(_data).length) {
          handleNoNewData(lastDataTimeRef.current);
        }

        if (isEventActiveRef.current) {
          addActiveEventIntervals(lastDataTimeRef.current);
        }

        // Always extend all open intervals to the new time
        updateOpenIntervals();
      }
    };

    // Register listeners for each pattern.
    patternIds.forEach((pid) => {
      webSocketService.addPatternListener(eventId, [pid], updateData);
    });

    patternIds.forEach(pid => {
      const key = `${eventId}-${pid}`;
      const cb  = prob =>
          setPatternProbs(prev => ({ ...prev, [pid]: prob }));

      webSocketService.addPatternProbabilityListener(key, cb);
      cleanupFns.push(() =>
          webSocketService.removePatternProbabilityListener(key, cb));
    });


    // Subscribe to centralized timing service instead of using own interval
    if (timingUnsubscribeRef.current) {
      timingUnsubscribeRef.current();
    }

    timingUnsubscribeRef.current = TimingService.subscribeToTimeAdvance((timestamp) => {
      // Update our local time references
      lastDataTimeRef.current = timestamp;

      // Handle chart updates when time advances
      if (chartRef.current) {
        handleNoNewData(timestamp);

        if (isEventActiveRef.current) {
          addActiveEventIntervals(timestamp);
        }

        updateOpenIntervals();
      }
    });

    const handleEventActiveUpdate = (isActive) => {
      isEventActiveRef.current = isActive;
    };
    webSocketService.addEventActiveListener(eventId, handleEventActiveUpdate);
    cleanupFns.push(() =>
      webSocketService.removeEventActiveListener(eventId, handleEventActiveUpdate)
    );

    const handleEventOccurredUpdate = (occurred, timestamp) => {
      handleEventOccurred(occurred, timestamp * 1000);
    };
    webSocketService.addEventOccurredListener(eventId, handleEventOccurredUpdate);
    cleanupFns.push(() =>
      webSocketService.removeEventOccurredListener(eventId, handleEventOccurredUpdate)
    );

    // Cleanup on unmount or dependency change.
    return () => {
      patternIds.forEach((pid) => {
        webSocketService.removePatternListener(eventId, [pid], updateData);
      });

      // Unsubscribe from centralized timing service
      if (timingUnsubscribeRef.current) {
        timingUnsubscribeRef.current();
        timingUnsubscribeRef.current = null;
      }

      cleanupFns.forEach(fn => fn());
      // Ensure we fully reset the chart when the component unmounts or the event changes
      if (chartRef.current) {
        // Clean up the custom resize handler if it exists
        if (chartRef.current.customResizeHandler) {
          window.removeEventListener('resize', chartRef.current.customResizeHandler);
        }
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [eventPatterns, webSocketService, eventId, eventTitle]);

  useEffect(() => {
    if (!Object.keys(patternProbs).length) return;
    const sorted = Object.entries(patternProbs)
                       .sort(([, a], [, b]) => b - a);
    if (!sorted.length) return;
    const [winnerId, winnerProb] = sorted[0];

    const newTop = winnerProb >= PROB_THRESHOLD ? Number(winnerId) : null;

    if (newTop !== topPatternIdRef.current) {
      topPatternIdRef.current = newTop;
      updateYAxisLabels();
    }
  }, [patternProbs]);

  // Process the new event_patterns data.
  const processEventPatterns = (eventPatternsData) => {
    if (!eventPatternsData) return;

    //console.log("Processing event patterns:", eventPatternsData);

    // For each pattern, process adding and deleting events.
    Object.keys(eventPatternsData).forEach((patternIdStr) => {
      const patternId = parseInt(patternIdStr, 10);
      // Ensure we have a list for this pattern.
      if (!openIntervalsRef.current[patternId]) {
        openIntervalsRef.current[patternId] = [];
      }
      const [addingList, deletingList] = eventPatternsData[patternIdStr];

      // Process interval additions.
      addingList.forEach((addEvent) => {
        // addEvent: [intervalId, timestamp]
        const intervalId = addEvent[0];
        const eventTimestamp = addEvent[1] * 1000; // convert seconds to ms
        // Only add if not already present.
        const exists = openIntervalsRef.current[patternId].some(
          (interval) => interval.id === intervalId
        );
        if (!exists) {
          //console.log(`Creating new interval for pattern ${patternId}, id ${intervalId} at ${eventTimestamp}`);
          createOpenInterval(patternId, eventTimestamp, intervalId);
        }
      });

      // Process interval deletions.
      deletingList.forEach((delEvent) => {
        // delEvent: [intervalId, timestamp]
        const intervalId = delEvent[0];
        const intervals = openIntervalsRef.current[patternId];
        const index = intervals.findIndex((interval) => interval.id === intervalId);
        if (index !== -1) {
          // console.log(`Removing interval for pattern ${patternId}, id ${intervalId}`);
          const intervalToRemove = intervals[index];
          if (intervalToRemove.point && intervalToRemove.point.remove) {
            intervalToRemove.point.remove(false); // false: don't redraw immediately
          }
          intervals.splice(index, 1);
        }
      });
    });
    // Redraw the chart after processing all events.
    const chart = chartRef.current;
    if (chart) {
      chart.redraw();
    }
  };

  // Create a new open interval and store it with a unique id.
  const createOpenInterval = (patternId, startTime, intervalId) => {
    const chart = chartRef.current;
    if (!chart) return;
    const patternIndex = eventPatterns.findIndex((p) => p.id === patternId);
    if (patternIndex === -1) return;

    // console.log("Creating open interval", patternId, startTime, intervalId);

    // Add the point without redrawing immediately.
    chart.series[0].addPoint(
      {
        x: startTime,
        x2: startTime + 1000, // Initial extension, will be updated by updateOpenIntervals
        y: toPatternRowIndex(patternIndex),
        name: eventPatterns[patternIndex].name,
        color: ' #6787A8',
        opacity: 0.4, // Match original opacity
        // borderWidth: '1px',           // Add border width
        // borderColor: ' #4A5568',   // Add border color
        tooltip: { enabled: false, pointFormatter: () => "" },
        enableMouseTracking: false,
      },
      false
    );

    // Redraw the chart so that the point is rendered.
    chart.redraw();

    // Retrieve the newly added point from the series data.
    const seriesData = chart.series[0].data;
    const newPoint = seriesData[seriesData.length - 1];

    // Store the open interval with its unique id.
    openIntervalsRef.current[patternId].push({
      id: intervalId,
      point: newPoint,
      startTime,
      open: true,
    });

    // Shift the x-axis if in real-time mode using the last point's x value.
    // Modified to match PatternIntervals (30 seconds window)
    if (isRealTimeRef.current) {
      const lastPoint = chart.series[0].points[chart.series[0].points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  // Adds a transparent placeholder when no new data is received.
  const handleNoNewData = (timestamp) => {
    const chart = chartRef.current;
    if (!chart) return;
    const series = chart.series[0];

    // console.log("Handling no new data at", new Date(timestamp).toISOString());

    for (let yIndex = 0; yIndex < totalRowCount; yIndex++) {
      series.addPoint(
        {
          x: timestamp,
          x2: timestamp + 1000,
          y: yIndex,
          name: '',
          color: 'rgba(0, 0, 0, 0)', // Very transparent black
          borderColor: 'transparent', // No border
          borderWidth: 0,
          zIndex: -1, // Sends it to the back
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false, // Disables mouse interaction
        },
        false
      );
    }

    chart.redraw();

    // Modified to match PatternIntervals (30 seconds window)
    if (isRealTimeRef.current) {
      const lastPoint = chart.series[0].points[chart.series[0].points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  // Light-red intervals on all pattern rows while event_active is true.
  const addActiveEventIntervals = (timestamp) => {
    const chart = chartRef.current;
    if (!chart || !chart.series[1]) return;

    const series = chart.series[1];
    eventPatterns.forEach((_pattern, patternIndex) => {
      series.addPoint(
        {
          x: timestamp,
          x2: timestamp + 1000,
          y: toPatternRowIndex(patternIndex),
          name: 'Active Event',
          color: EVENT_ACTIVE_COLOR,
          borderWidth: 0,
          borderColor: 'transparent',
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
        },
        false
      );
    });

    chart.redraw();
  };

  // Open or close the darker-red event-row interval based on event_occurred.
  const handleEventOccurred = (occurred, timestampMs) => {
    const chart = chartRef.current;
    if (!chart || !chart.series[2]) return;

    const endTime = (timestampMs ?? lastDataTimeRef.current) + 1000;

    if (occurred) {
      if (!eventOccurrenceRef.current?.open) {
        chart.series[2].addPoint(
          {
            x: timestampMs ?? lastDataTimeRef.current,
            x2: endTime,
            y: eventRowIndex,
            name: eventLabel,
            color: EVENT_OCCURRED_COLOR,
            borderWidth: 0,
            borderColor: 'transparent',
            tooltip: { enabled: false, pointFormatter: () => "" },
            enableMouseTracking: false,
          },
          false
        );

        const seriesData = chart.series[2].data;
        eventOccurrenceRef.current = {
          point: seriesData[seriesData.length - 1],
          open: true,
        };
        chart.redraw();
      }
    } else if (eventOccurrenceRef.current?.open && eventOccurrenceRef.current.point) {
      eventOccurrenceRef.current.point.update({ x2: endTime }, false);
      eventOccurrenceRef.current.open = false;
      eventOccurrenceRef.current = null;
      chart.redraw();
    }
  };

  const updateYAxisLabels = () => {
    const chart = chartRef.current;
    if (!chart) return;

    const urgent = topPatternIdRef.current;
    const newCats = [
      eventLabel,
      ...eventPatterns.map(p =>
        p.id === urgent
          ? `<span style="color:#C21212;font-weight:bold;">${p.name}</span>`
          : p.name
      ),
    ];

    chart.yAxis[0].setCategories(newCats, false);
    chart.redraw();
  };

  // On each tick, extend all open intervals to the current time.
  const updateOpenIntervals = () => {
    const chart = chartRef.current;
    if (!chart || lastDataTimeRef.current === null) return;

    // console.log("Updating open intervals to", new Date(lastDataTimeRef.current).toISOString());

    const endTime = lastDataTimeRef.current + 1000;
    let updated = false;

    Object.entries(openIntervalsRef.current).forEach(([patternId, intervalList]) => {
      intervalList.forEach((entry) => {
        if (entry.open && entry.point && entry.point.update) {
          try {
            entry.point.update({ x2: endTime }, false);
            updated = true;
           // console.log(`Extended interval for pattern ${patternId}, id ${entry.id} to ${endTime}`);
          } catch (error) {
            console.error(`Failed to update interval for pattern ${patternId}, id ${entry.id}:`, error);
          }
        }
      });
    });

    if (eventOccurrenceRef.current?.open && eventOccurrenceRef.current.point?.update) {
      try {
        eventOccurrenceRef.current.point.update({ x2: endTime }, false);
        updated = true;
      } catch (error) {
        console.error('Failed to update event occurrence interval:', error);
      }
    }

    if (updated) {
      chart.redraw();
    }

    // Modified to match PatternIntervals (30 seconds window)
    if (isRealTimeRef.current) {
      const lastPoint = chart.series[0].points[chart.series[0].points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  // Initialize the Highcharts chart.
  const initializeChart = () => {
    if (chartRef.current) {  // TODO: Check if this is needed
      chartRef.current.destroy();     // removes old SVG + frees memory
      chartRef.current = null;        // clear the ref
    }
    const initialData = [
      {
        x: 0,
        x2: 0,
        y: eventRowIndex,
        name: eventLabel,
        color: 'transparent',
        dataLabels: {
          enabled: false,
          format: '{point.name}'
        }
      },
      ...eventPatterns.map((pattern, index) => ({
        x: 0,
        x2: 0,
        y: toPatternRowIndex(index),
        name: pattern.name,
        color: 'transparent',
        dataLabels: {
          enabled: false,
          format: '{point.name}'
        }
      })),
    ];

    const options = {
      chart: {
        type: 'xrange',
        marginLeft: 100,
        marginRight: dynamicMarginRight,
        height: chartHeight, // Use dynamic height
        animation: false, // Disable chart animation
        events: {
          load() {
            chartRef.current = this;

            // Force 30-second view on initial load
            const chart = this;
            const now = Date.now();
            chart.xAxis[0].setExtremes(now - 30000, now, true, false);

            const updateButtonPositions = () => {

              const chartWidth = chart.chartWidth;

              if (!chart.customButtons) {
                chart.customButtons = {};

                chart.customButtons.realTimeButton = chart.renderer.button('Now', chartWidth - 75, 10)
                  .attr({ zIndex: 3, height: 6 })
                  .on('click', function () {
                    isRealTimeRef.current = true;
                    const xAxis = chart.xAxis[0];
                    if (xAxis.dataMax) {
                      const xMax = xAxis.dataMax + 2000;
                      const xMin = Math.max(0, xMax - 30000); // Changed from 60000 to 30000
                      xAxis.setExtremes(xMin, xMax + 1000, true, true);
                    }
                  })
                  .add();

                // chart.customButtons.toggleGraphsButton = chart.renderer.button('Show Graphs', chartWidth - 125, 10)
                //   .attr({ zIndex: 3, height: 6 })
                //   .on('click', toggleRelatedGraphs)
                //   .add();
              } else {
                chart.customButtons.realTimeButton.attr({ x: chartWidth - 75 });
                // chart.customButtons.toggleGraphsButton.attr({ x: chartWidth - 125 });
              }
            };

            updateButtonPositions();

            chartRef.current.redraw = function () {
              Highcharts.Chart.prototype.redraw.call(this);
              updateButtonPositions();
            };

            const handleResize = function () {
              if (chartRef.current && chartRef.current.reflow) {
                chartRef.current.reflow();
                updateButtonPositions();
              }
            };

            window.addEventListener('resize', handleResize);

            // Store the event listener for cleanup
            chartRef.current.customResizeHandler = handleResize;
          },
          selection: function (event) {
            if (event.xAxis) {
              isRealTimeRef.current = false;
            }
            return true;
          }
        }
      },
      accessibility: {
        enabled: false // Disable accessibility module to remove warning
      },
      title: {
        //text: eventTitle || `Event ${eventId}`,
        align: 'left',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
        },
        y: 15,
      },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime',
        title: { text: '' },
        labels: getXAxisLabelsConfig(),
        min: null,
        max: null,
        events: {
          setExtremes(e) {
            if (e.trigger !== 'syncExtremes') {
              isRealTimeRef.current = false; // Changed from true to false to match PatternIntervals
            }
          },
        },
      },
      yAxis: [
        {
          title: { text: '', align: 'high', offset: 0, rotation: 0, y: -10, x: -50 },
          categories: [eventLabel, ...eventPatterns.map((p) => p.name)],
          reversed: true,
          opposite: false, // Place y-axis on the left side
          labels: {
            align: 'right',
            x: -10,
            style: { fontSize: '12px' },
          },
          lineWidth: 1,
        },
      ],
      rangeSelector: {
        enabled: true,
        buttons: [
          { count: 30, type: 'second', text: '30s' },
          { count: 1, type: 'minute', text: '1m' },
          { type: 'all', text: 'All' },
        ],
        inputEnabled: false,
        selected: 0, // Explicitly select the first button (30s)
        buttonTheme: {
          states: {
            select: {
              fill: '#6787A8',
              style: {
                color: 'white'
              }
            }
          }
        }
      },
      navigator: { enabled: false },
      scrollbar: { enabled: true },
      plotOptions: {
        series: {
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
          animation: false // Disable animation for all series
        },
        xrange: {
          grouping: false,
          animation: false // Disable animation for xrange specifically
        }
      },
      series: [
        {
          name: 'Patterns',
          data: initialData,
          colorByPoint: false,
          pointWidth: calculateIntervalHeight(totalRowCount, chartHeight),
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
          animation: false, // Disable animation for this series
          borderRadius: 0,
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
          zIndex: 2, // Base layer
        },
        {
          name: 'Active Events',
          data: [],
          colorByPoint: false,
          color: EVENT_ACTIVE_COLOR,
          pointWidth: Math.max(22, (chartHeight - 120) / totalRowCount * 0.99 + 0),
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
          animation: false,
          borderRadius: 0,
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
          zIndex: 1,
        },
        {
          name: 'Event Occurred',
          data: [],
          colorByPoint: false,
          color: EVENT_OCCURRED_COLOR,
          pointWidth: Math.max(22, (chartHeight - 120) / totalRowCount * 0.99 + 0),
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
          animation: false,
          borderRadius: 0,
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
          zIndex: 3,
        },
      ],
    };

    Highcharts.stockChart(graphId, options);
  };

  const showRightEdgeAids = getShowRightEdgeAids();

  return (
    <div style={{position: 'relative'}}>
      {/* Render the chart container with the specified graphId */}
      <div
          id={graphId}
          style={{
            height: `${chartHeight}px`, // Use dynamic height
            width: '100%',
            border: '2px solid #CCCCCC',// #7F7F7F',
            borderRadius: '4px',
            padding: '5px',
            margin: '0',
            marginBottom: '0px',
            boxSizing: 'border-box',
            backgroundColor: '#FFFFFF',
          }}
      />
           {chartRef.current && showRightEdgeAids && (
       <>
         <RightEdgeLine chartRef={chartRef} />
         <HorizontalRefLine chartRef={chartRef} />
         <ProbabilityBox
           chartRef={chartRef}
           probability={probability_graph}
           tte={tte_graph / 1}
           eventName={eventTitle}
           chartHeight={chartHeight}
           isEventActive={isEventActive}
           isEventOccurred={isEventOccurred}
           patternCount={totalRowCount}
         />
       </>
     )}
    </div>
);
}