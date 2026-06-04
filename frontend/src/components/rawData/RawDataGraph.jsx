import { useState, useEffect, useRef, useCallback } from "react";
import Highcharts from "highcharts/highstock";
import DataManagementService from "../dataService/DataManagementService";
import TimingService from "../dataService/TimingService";
import { getXAxisLabelsConfig } from "../../utils/xAxisFormatter";

// Simple debounce helper
const debounce = (func, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

export default function RawDataGraph({
  temporalPropertyIdToShow,
  graphId,
  DataUpdateService,
  title,
  states,
  initialData,
  onVisibilityChange,
  isVisible,
  eventId = 0,
  isNegative = false
}) {
  const chartRef = useRef(null);
  const isRealTimeRef = useRef(true);
  const wasVisible = useRef(false);
  const resizeHandlerRef = useRef(null);
  const lastDataTimeRef = useRef(null);           // In milliseconds
  const lastDataReceivedTimeRef = useRef(null);   // In milliseconds
  const timingUnsubscribeRef = useRef(null);      // For centralized timing service
  const [chartTitle, setChartTitle] = useState(title || `Property ${temporalPropertyIdToShow} (Raw Data)`);
  const [hasData, setHasData] = useState(false); // Track if we have any data
  const [normalBounds, setNormalBounds] = useState(null); // Store normal bounds
  const [normalRangeWithPadding, setNormalRangeWithPadding] = useState(null); // Store pre-calculated range with padding

  // Fetch normal bounds when component mounts or temporalPropertyIdToShow changes
  useEffect(() => {
    const fetchNormalBounds = async () => {
      try {
        const allBounds = await DataManagementService.fetchAllNormalBounds();
        if (allBounds && allBounds[temporalPropertyIdToShow]) {
          const bounds = allBounds[temporalPropertyIdToShow];
          // Convert string values to numbers if needed
          const lowBound = typeof bounds[0] === 'string' ? parseFloat(bounds[0]) : bounds[0];
          const highBound = typeof bounds[1] === 'string' ? parseFloat(bounds[1]) : bounds[1];
          
          // Store normal bounds
          setNormalBounds([lowBound, highBound]);
          
          // Pre-calculate normal range with padding
          const padding = (highBound - lowBound) / 6;
          const minValue = lowBound > 0 && lowBound - padding < 0 ? 0 : lowBound - padding;
          const maxValue = highBound + padding;
          
          // Apply isNegative constraint when calculating the range
          const adjustedMinValue = !isNegative && minValue < 0 ? 0 : minValue;
          
          // Store the pre-calculated range with padding
          setNormalRangeWithPadding({ min: adjustedMinValue, max: maxValue });
          
          // Update chart if it already exists
          if (chartRef.current) {
            chartRef.current.yAxis[0].update({
              plotBands: [{
                from: lowBound,
                to: highBound,
                color: 'rgba(144, 238, 144, 0.15)', // Light green with transparency
              }],
              min: adjustedMinValue,
              max: maxValue
            }, true);
          }
        } else {
          setNormalBounds(null);
          setNormalRangeWithPadding(null);
        }
      } catch (error) {
        console.error('Error fetching normal bounds:', error);
        setNormalBounds(null);
        setNormalRangeWithPadding(null);
      }
    };

    if (isVisible && temporalPropertyIdToShow) {
      fetchNormalBounds();
    }
  }, [temporalPropertyIdToShow, isVisible, isNegative]);

  // Simplified function to adjust y-axis to show all data points
  const adjustYAxisToShowAllData = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !normalRangeWithPadding || !chart.series[0]) return;
    
    // Start with pre-calculated normal range with padding
    let minValue = normalRangeWithPadding.min;
    let maxValue = normalRangeWithPadding.max;
    let needsUpdate = false;
    
    // Find min/max of actual data points
    const points = chart.series[0].points || [];
    const dataValues = points
      .filter(p => p.y !== null)
      .map(p => p.y);
    
    if (dataValues.length > 0) {
      const dataMin = Math.min(...dataValues);
      const dataMax = Math.max(...dataValues);
      
      // Only update if data points are outside the normal range with padding
      if (dataMin < minValue || dataMax > maxValue) {
        minValue = Math.min(minValue, dataMin);
        maxValue = Math.max(maxValue, dataMax);
        
        // Add small padding for better visibility
        const extraPadding = (maxValue - minValue) * 0.05;
        minValue -= extraPadding;
        maxValue += extraPadding;
        
        // Apply isNegative constraint - if isNegative is false, ensure min is not below 0
        if (!isNegative && minValue < 0) {
          minValue = 0;
        }
        
        chart.yAxis[0].setExtremes(minValue, maxValue, true);
      }
    }
  }, [normalRangeWithPadding, normalBounds, isNegative]);

  // Update title when it changes
  useEffect(() => {
    if (title && title !== chartTitle) {
      setChartTitle(title);
      
      // Update chart title if chart exists
      if (chartRef.current) {
        chartRef.current.setTitle({ text: title });
      }
    }
  }, [title, chartTitle]);

  // Only call onVisibilityChange once when isVisible first becomes true
  useEffect(() => {
    if (onVisibilityChange && isVisible && !wasVisible.current) {
      onVisibilityChange();
      wasVisible.current = true;
    }
  }, [onVisibilityChange, isVisible]);

  // Update lastDataTimeRef on new data
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      const last = initialData[initialData.length - 1];
      if (last && last.time) {
        lastDataTimeRef.current = last.time * 1000;
      }
    }
  }, [initialData]);

  // Function to make data points transparent within a specified time range
  const makeDataPointsTransparent = useCallback((startTime, endTime) => {
    const chart = chartRef.current;
    if (!chart) return;

    // console.log(`[RawDataGraph] Making data points transparent for property ${temporalPropertyIdToShow} in time range [${startTime}, ${endTime}]`);

    const rawDataSeries = chart.series[0];
    let dataModified = 0;

    // Make data points transparent within the time range
    rawDataSeries.data.forEach((point) => {
      const pointTime = point.x;
      if (pointTime >= startTime && pointTime <= endTime) {
        point.update({
          y: null, // Make point invisible
          marker: { enabled: false }, // Hide marker
        }, false);
        dataModified++;
      }
    });

    //console.log(`[RawDataGraph] Made ${dataModified} data points transparent`);

    chart.redraw();

    // Update real-time view if needed - no need to change extremes since points are still there
    if (isRealTimeRef.current && rawDataSeries.data.length > 0) {
      const lastPoint = rawDataSeries.data[rawDataSeries.data.length - 1];
      chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
    }
  }, [temporalPropertyIdToShow]);

  // Function to initialize chart when data becomes available
  const initializeChartWithData = useCallback(() => {
    if (!hasData || chartRef.current) return; // Don't initialize if no data or chart already exists
    
    //console.log(`[RawDataGraph] Initializing chart for property ${temporalPropertyIdToShow} as data is now available`);
    
    // Initialize the chart
    initializeChart();
    
    // Initialize time references using centralized timing service
    lastDataTimeRef.current = TimingService.getCurrentTimestamp();
    lastDataReceivedTimeRef.current = TimingService.getCurrentTimestamp();

    // Ensure real-time mode is active
    isRealTimeRef.current = true;

    // Subscribe to centralized timing service instead of using own interval
    if (timingUnsubscribeRef.current) {
      timingUnsubscribeRef.current();
    }
    
    timingUnsubscribeRef.current = TimingService.subscribeToTimeAdvance((timestamp) => {
      // Update our local time references
      lastDataTimeRef.current = timestamp;
      
      // Only update chart if it's initialized and visible
      if (chartRef.current && isVisible) {
        handleNoNewData(timestamp);
      }
    });
    
    // Get stored data for this property and populate it
    let storedData = DataUpdateService.getStoredData(temporalPropertyIdToShow, eventId);
    
    // If we have initial data from props, use that
    if (initialData && initialData.length > 0) {
      populateInitialData(initialData);
    } 
    // Otherwise use stored data if available
    else if (storedData && storedData.length > 0) {
      populateInitialData(storedData);
    }
  }, [hasData, temporalPropertyIdToShow, isVisible, initialData, DataUpdateService, eventId]);

  // Handle data updates
  useEffect(() => {
    const updateData = (filteredData, intervalsToFix) => {
      // Always update timing references when any data is received
      if (filteredData && filteredData.time) {
        const timestampMs = filteredData.time * 1000;
        lastDataReceivedTimeRef.current = timestampMs;
        lastDataTimeRef.current = timestampMs;
      }
      
      // If this is the first data we're receiving, mark that we have data
      if (!hasData) {
        setHasData(true);
      }
      
      if (chartRef.current && isVisible) {
        // Handle interval deletion first if needed
        if (intervalsToFix && Array.isArray(intervalsToFix)) {
          const [startTime, endTime] = intervalsToFix;
          makeDataPointsTransparent(startTime * 1000, endTime * 1000);
        }
        // Then update with new data
        updateChart(filteredData);
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
  }, [isVisible, temporalPropertyIdToShow, DataUpdateService, eventId, makeDataPointsTransparent, hasData]);

  // Timestamp listener for continuous graph progression
  useEffect(() => {
    const handleTimestamp = (timestamp, entity_data, intervalsToFix) => {
      // Always update timing references when any timestamp is received
      const timestampMs = timestamp * 1000;
      lastDataReceivedTimeRef.current = timestampMs;
      lastDataTimeRef.current = timestampMs;
      
      if (chartRef.current && isVisible) {
        // Handle interval deletion for this property if needed
        if (intervalsToFix && intervalsToFix[temporalPropertyIdToShow] && Array.isArray(intervalsToFix[temporalPropertyIdToShow])) {
          const [startTime, endTime] = intervalsToFix[temporalPropertyIdToShow];
          makeDataPointsTransparent(startTime * 1000, endTime * 1000);
        }
        
        // Check if we have actual data for this temporal property
        const hasDataForProperty = entity_data[temporalPropertyIdToShow];
        
        if (!hasDataForProperty) {
          // Add transparent data point to keep graph progressing
          //console.log(`[RawDataGraph] Adding transparent data point for property ${temporalPropertyIdToShow} at timestamp ${timestamp}`);
          const transparentData = {
            time: timestamp,
            raw_value: 0,
            transparent: true
          };
          updateChart(transparentData, true); // true = transparent
        }
        // If we have actual data, it will be handled by the regular updateData callback
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
  }, [isVisible, eventId, temporalPropertyIdToShow, makeDataPointsTransparent]);

  // When the graph becomes visible, always trigger a "Real Time" update
  useEffect(() => {
    if (isVisible && chartRef.current) {
      const realTimeButton = chartRef.current.customButtons?.realTimeButton;
      if (realTimeButton && realTimeButton.element) {
        realTimeButton.element.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      }
      
      // Ensure y-axis is properly adjusted when becoming visible
      // This is especially important when expanding from sidebar
      setTimeout(() => {
        adjustYAxisToShowAllData();
      }, 100);
    }
  }, [isVisible, adjustYAxisToShowAllData]);

  // Initialize chart when data becomes available
  useEffect(() => {
    if (hasData && isVisible) {
      initializeChartWithData();
    }
  }, [hasData, isVisible, initializeChartWithData]);

  useEffect(() => {
    const checkForData = async () => {
      try {
        // Get stored data for this property
        let storedData = DataUpdateService.getStoredData(temporalPropertyIdToShow, eventId);
        
        // Check if we have any data available
        const hasInitialData = initialData && initialData.length > 0;
        const hasStoredData = storedData && storedData.length > 0;
        
        if (hasInitialData || hasStoredData) {
          setHasData(true);
        } else {
          //console.log(`No initial data available for property ${temporalPropertyIdToShow}, will wait for updates`);
          setHasData(false);
        }
      } catch (error) {
        console.error("Error checking for data:", error);
        setHasData(false);
      }
    };

    // Only check for data if the component is visible
    if (isVisible) {
      checkForData();
    }

    // Cleanup on unmount
    return () => {
      // Unsubscribe from centralized timing service
      if (timingUnsubscribeRef.current) {
        timingUnsubscribeRef.current();
        timingUnsubscribeRef.current = null;
      }
      
      if (chartRef.current) {
        if (resizeHandlerRef.current) {
          window.removeEventListener("resize", resizeHandlerRef.current);
        }
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [temporalPropertyIdToShow, eventId, isVisible, initialData, DataUpdateService]);

  // Add handleNoNewData function for tick-forward mechanism
  const handleNoNewData = (timestamp) => {
    const chart = chartRef.current;
    if (!chart) return;
    
    //console.log(`[RawDataGraph] Handling no new data at timestamp ${timestamp} for property ${temporalPropertyIdToShow}`);
    
    const rawDataSeries = chart.series[0];
    
    // Add transparent data point to keep graph progressing
    rawDataSeries.addPoint([timestamp, null], true, rawDataSeries.data.length >= 120);
    
    // Update real-time view if needed
    if (isRealTimeRef.current) {
      const lastPoint = rawDataSeries.points[rawDataSeries.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  const initializeChart = () => {
    // Format title to include property ID
    const formattedTitle = chartTitle;

    // Prepare plotBands for normal range if available
    const plotBands = normalBounds ? [{
      from: normalBounds[0],
      to: normalBounds[1],
      color: 'rgba(144, 238, 144, 0.15)', // Light green with transparency
    }] : [];

    const options = {
      chart: {
        type: "line",
        marginLeft: 40,
        marginRight: 30,
        marginTop: 30, // Increased to give more space for title
        spacingTop: 10,
        spacingBottom: 10,
        height: 230,
        animation: false,
        backgroundColor: '#FFFFFF', // Set background color to white
        events: {
          load: function () {
            chartRef.current = this;

            const updateButtonPositions = () => {
              const chart = chartRef.current;
              const chartWidth = chart.chartWidth;
              if (!chart.customButtons) {
                chart.customButtons = {};

                chart.customButtons.realTimeButton = chart.renderer
                  .button("Now", chartWidth - 75, 30)
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
              } else {
                chart.customButtons.realTimeButton.attr({ x: chartWidth - 75 });
              }
            };

            updateButtonPositions();

            // Override the chart's redraw to also update button positions
            chartRef.current.redraw = function () {
              Highcharts.Chart.prototype.redraw.call(this);
              updateButtonPositions();
            };

            // Debounce the resize handler
            resizeHandlerRef.current = debounce(() => {
              chartRef.current.reflow();
              updateButtonPositions();
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
      accessibility: {
        enabled: false // Disable accessibility module to remove warning
      },
      title: {
        text: null // Remove Highcharts title, we'll use custom div
      },
      credits: { enabled: false },
      xAxis: {
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
      },
      yAxis: {
        title: { text: "" },
        opposite: false,
        labels: { 
          align: "right", 
          x: -10, 
          style: { fontSize: "12px" } // Reduced from 14px to 12px
        },
        lineWidth: 1,
        // Using dynamic min/max with initial values based on normal bounds
        startOnTick: true,
        endOnTick: true,
        minPadding: 0.05,
        maxPadding: 0.05,
        // Set initial min/max if normal range with padding is available
        min: normalRangeWithPadding ? normalRangeWithPadding.min : undefined,
        max: normalRangeWithPadding ? normalRangeWithPadding.max : undefined,
        // Allow Highcharts to determine the best tick positions
        tickAmount: 5,
        // Add plotBands for normal range
        plotBands: plotBands
      },
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
      series: [{
        name: "Raw Data",
        type: "line",
        data: [],
        color: 'transparent', // Make line color transparent
        lineWidth: 0, // Remove connecting lines between data points
        marker: {
          enabled: true,
          radius: 3,
          fillColor: '#B0C4D9' // Keep marker color visible
        },
        animation: false,
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
      }]
    };

    Highcharts.stockChart(graphId, options);
  };

  const populateInitialData = (data) => {
    if (!data || data.length === 0) return;
    
    //console.log(`Populating ${data.length} initial data points for property ${temporalPropertyIdToShow}`);
    
    // Convert data to format expected by Highcharts
    const chartData = data.map(point => {
      const time = point.time * 1000; // Convert to milliseconds
      
      // Check if raw_value is None/null/undefined from backend or if explicitly transparent
      const isNoneValue = point.raw_value === null || point.raw_value === undefined || point.raw_value === 'None';
      const isTransparent = point.transparent || point.deleted || isNoneValue;
      
      if (isTransparent) {
        return [time, null]; // Use null for transparent/deleted/None points
      } else {
        const rawValue = parseFloat(point.raw_value);
        return isNaN(rawValue) ? [time, null] : [time, rawValue];
      }
    });
    
    if (chartRef.current && chartRef.current.series && chartRef.current.series[0]) {
      chartRef.current.series[0].setData(chartData, true);
      
      // Set extremes to show the data
      if (chartData.length > 0) {
        const lastPoint = chartData[chartData.length - 1];
        const firstPoint = chartData[0];
        const timeRange = Math.min(30000, lastPoint[0] - firstPoint[0]);
        chartRef.current.xAxis[0].setExtremes(
          lastPoint[0] - timeRange,
          lastPoint[0] + 1000,
          true
        );
      }

      // Adjust y-axis to show both normal range and all data points
      adjustYAxisToShowAllData();
    } else {
     // console.warn("Chart not initialized yet, can't populate data");
    }
  };

  const updateChart = (data, transparent = false) => {
    const chart = chartRef.current;
    if (!chart || !chart.series || !chart.series[0]) return;

    const rawDataSeries = chart.series[0];
    const time = data.time * 1000;
    
    // Check if raw_value is None/null/undefined from backend or if explicitly transparent
    const isNoneValue = data.raw_value === null || data.raw_value === undefined || data.raw_value === 'None';
    const isTransparent = transparent || data.transparent || data.deleted || isNoneValue;
    
    // Log when None values are encountered
    if (isNoneValue) {
     // console.log(`[RawDataGraph] Received None value for property ${temporalPropertyIdToShow} at timestamp ${data.time}, adding transparent point`);
    }
    
    // Handle transparent data with null values
    const rawValue = isTransparent ? null : parseFloat(data.raw_value);
    
    // Only show warning for actual invalid values (not None/null/undefined)
    if (!isTransparent && isNaN(rawValue)) {
      console.warn(`Invalid raw value for property ${temporalPropertyIdToShow}:`, data.raw_value);
      // Still add a null point to maintain timeline continuity
      rawDataSeries.addPoint([time, null], true, rawDataSeries.data.length >= 120);
    } else {
      // Add the new data point (null for transparent/None, actual value for real data)
      rawDataSeries.addPoint([time, rawValue], true, rawDataSeries.data.length >= 120);
    }

    if (isRealTimeRef.current) {
      const lastPoint = rawDataSeries.points[rawDataSeries.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }

    // Check if the new data point is outside the current y-axis range
    if (rawValue !== null && normalRangeWithPadding) {
      const yAxis = chart.yAxis[0];
      if (rawValue < yAxis.min || rawValue > yAxis.max) {
        // Use the optimized adjustYAxisToShowAllData function
        adjustYAxisToShowAllData();
      }
    }
  };

  return (
    <div
      style={{
        height: hasData ? "230px" : "50px", // Reduced height when no data
        width: "100%",
        borderRadius: "4px",
        padding: "5px",
        margin: "0",
        marginBottom: "0px",
        boxSizing: "border-box",
        backgroundColor: '#FFFFFF',
        position: "relative" // Add relative positioning for proper title placement
      }}
    >
      {/* Custom title that appears over both chart and no-data state */}
      <div
        style={{
          position: "absolute",
          top: hasData ? "12px" : "12px", // Adjust top position based on data availability
          left: "15px",
          fontSize: "16px",
          fontWeight: "bold",
          color: "#333",
          whiteSpace: "normal",
          width: "80%",
          zIndex: 10 // Ensure title appears above chart
        }}
      >
        {chartTitle}
      </div>
      
      {hasData ? (
        <div
          id={graphId}
          style={{
            height: "100%",
            width: "100%"
          }}
        ></div>
      ) : (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "row", // Changed to row for horizontal layout
            justifyContent: "flex-end", // Align to right side
            alignItems: "center",
            backgroundColor: '#FFFFFF',
            position: "relative",
            paddingRight: "30px" // Add some padding from the right edge
          }}
        >
          <div
            style={{
              fontSize: "14px", // Smaller font size
              color: "#999", // Lighter color
              fontStyle: "italic" // Italic style
            }}
          >
            No Data Available
          </div>
        </div>
      )}
    </div>
  );
} 