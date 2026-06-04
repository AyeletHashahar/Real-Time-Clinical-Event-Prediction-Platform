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

export default function UniformIntervalsChart({
  temporalPropertyIdToShow,
  graphId,
  DataUpdateService,
  title,
  states,
  initialData,
  onVisibilityChange,
  isVisible,
  eventId,
  highlightedIntervals = [],
  binGapPx
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
    rawDataSeries.addPoint({ x: timestamp, y: null, rawValue: null }, false);

    chart.redraw();

    if (isRealTimeRef.current) {
      const activeSeries = rawDataSeries;
      const lastPoint = activeSeries.points[activeSeries.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  // Map a raw value to a y position in the scaled pixel axis (yAxis[1])
  const projectRawToScaledY = (rawValue, cutoffTicks, scaledBinMap) => {
    if (!Array.isArray(cutoffTicks) || cutoffTicks.length < 2 || !scaledBinMap) {
      return null;
    }

    // Below first cutoff → clamp to first bin min
    if (rawValue <= cutoffTicks[0]) {
      const b0 = scaledBinMap[0];
      return b0 ? b0.scaledMin : null;
    }
    // Above last cutoff → clamp to last bin max
    if (rawValue >= cutoffTicks[cutoffTicks.length - 1]) {
      const lastIdx = cutoffTicks.length - 2;
      const bl = scaledBinMap[lastIdx];
      return bl ? bl.scaledMax : null;
    }

    // Find bin i: [low, high)
    for (let i = 0; i < cutoffTicks.length - 1; i++) {
      const low = cutoffTicks[i];
      const high = cutoffTicks[i + 1];
      if (rawValue >= low && rawValue < high) {
        const bin = scaledBinMap[i];
        if (!bin) return null;
        const spanRaw = Math.max(1e-9, high - low);
        const spanPix = bin.scaledMax - bin.scaledMin; // uniform height per bin
        const t = (rawValue - low) / spanRaw;          // 0..1 within the bin
        return bin.scaledMin + t * spanPix;            // exact position inside the bar
      }
    }
    return null;
  };


  // Helper: Calculate scaled bin positions based on proportional sizing
  // Helper: Calculate UNIFORM bin positions (same visual height for every bin)
  const calculateScaledBinPositions = (cutoffTicks, chartHeight = 230) => {
    if (!cutoffTicks || cutoffTicks.length < 2) return {};

    const binCount = cutoffTicks.length - 1;
    const binHeight = chartHeight / binCount;           // equal space per bin
    const barHeight = Math.max(1, binHeight - binGapPx); // leave a tiny gap

    const scaledBinMap = {};
    for (let i = 0; i < binCount; i++) {
      const scaledMin = i * binHeight;
      const scaledMax = scaledMin + binHeight;
      const scaledCenter = (scaledMin + scaledMax) / 2;

      scaledBinMap[i] = {
        rawMin: cutoffTicks[i],
        rawMax: cutoffTicks[i + 1],
        scaledMin,
        scaledMax,
        scaledCenter,
        scaledHeight: barHeight    // <-- same height for all bins
      };
    }
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
                  return scaledTickLabels[this.value] !== undefined ? scaledTickLabels[this.value] : this.value;
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
              return Math.round(rawValue);
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
          labels: { align: "right", x: -10, style: { fontSize: "14px" } },
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
          yAxis: 1, // Use the scaled pixel axis (same as intervals)
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
            pointFormatter: function () {
             const v = (this.rawValue ?? null);
             return `<b>${v !== null ? v : ''}</b><br/>${Highcharts.dateFormat('%H:%M:%S', this.x)}`;
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

      if (isTransparent || isDeleted) {
         rawData.push({ x: time, y: null, rawValue: null });
       } else {
         const yScaled = projectRawToScaledY(rawValue, cutoffTicksRef.current, scaledBinMapRef.current);
         rawData.push({ x: time, y: yScaled, rawValue });
       }
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

    const rawPoint = isTransparent
       ? { x: time, y: null, rawValue: null }
       : { x: time, y: projectRawToScaledY(rawValue, cutoffTicksRef.current, scaledBinMapRef.current), rawValue };
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

