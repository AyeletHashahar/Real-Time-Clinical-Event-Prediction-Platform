import { useState, useEffect, useRef } from "react"; 
import Highcharts from "highcharts/highstock";
import xrange from 'highcharts/modules/xrange';
import { useVisibleGraphs } from '../graphs/GraphContext';
import DataManagementService from '../dataService/DataManagementService';
import TimingService from '../dataService/TimingService';
import PatternModal from './patternInfo/PatternPopup';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { useEventContext } from '../events/EventContext';
import { usePatternContext } from './PatternContext';
import { getXAxisLabelsConfig } from '../../utils/xAxisFormatter';

xrange(Highcharts);

const formatEventLabel = (title, eventId) =>
  (title || `Event ${eventId}`).replace(/_/g, ' ');

const EVENT_ROW_EXTRA_HEIGHT = 30;
const EVENT_OCCURRED_COLOR = 'rgb(150, 0, 0)';
const EVENT_ROW_INDEX = 0;
const toStateRowIndex = (stateIndex) => stateIndex + 1;
const FIRST_STATE_ROW_INDEX = 1;

export default function PatternIntervals({ patternIndex, eventIndex, graphId, webSocketService }) {
  const chartRef = useRef(null);
  const currentIntervalsRef = useRef({});
  const isRealTimeRef = useRef(true);
  const lastDataTimeRef = useRef(null);           // In milliseconds
  const lastDataReceivedTimeRef = useRef(null);   // In milliseconds
  const stateMapRef = useRef({});
  const stateIdToYIndexMapRef = useRef({});
  const [patternData, setPatternData] = useState(null);
  const [eventLabel, setEventLabel] = useState('');
  const { visibleGraphs, toggleGraphVisibility, showOnlyGraphs, setHighlightedIntervals } = useVisibleGraphs();
  const [relatedTemporalPropertyIds, setRelatedTemporalPropertyIds] = useState([]);
  const [patternProb, setPatternProb] = useState(0);
  const { selectedEvent } = useEventContext();
  const { selectedPatternIndex } = usePatternContext();

  // Calculate dynamic margin right based on webpage width, capped at 180px (same as MainEventGraph)
  const dynamicMarginRight = Math.min(180, Math.max(50, window.innerWidth * 0.12));

  // Dynamic chart configuration based on pattern context
  const getChartConfig = () => {
    const baseHeight = 230 + EVENT_ROW_EXTRA_HEIGHT;
    if (selectedPatternIndex === null) {
      // All Patterns mode - match MainEventGraph configuration
      return {
        marginLeft: 100,
        marginRight: dynamicMarginRight,
        marginTop: undefined, // Use default
        spacingTop: undefined, // Use default
        spacingBottom: undefined, // Use default
        height: baseHeight
      };
    } else {
      // Specific Pattern mode - match GraphIntervals configuration
      return {
        marginLeft: 100,
        marginRight: 30,
        marginTop: 30,
        spacingTop: 10,
        spacingBottom: 10,
        height: baseHeight
      };
    }
  };

  // New state and refs for TIRPs
  const [tirpInstances, setTirpInstances] = useState([]);
  const [selectedTirpIndex, setSelectedTirpIndex] = useState(-1);
  const highlightedIntervalsRef = useRef([]);
  const openIntervalsRef = useRef({}); // To track open highlighted intervals
  
  // Add tracking for currently highlighted TIRPs to handle deletions gracefully
  const currentlyHighlightedTirpsRef = useRef(new Set());
  
  // Add tracking for pattern-specific open intervals
  const patternOpenIntervalsRef = useRef([]); // Array to track pattern-specific open intervals
  
  // Add a new ref to store pending pattern intervals that haven't been added to the chart yet
  const pendingPatternIntervalsRef = useRef({
    adding: [],
    deleting: []
  });
  
  const eventRowIndexRef = useRef(0);
  const eventLabelRef = useRef('');
  const eventOccurrenceRef = useRef(null);
  const chartInitializedRef = useRef(false);
  
  // Add state to track if graphs are visible
  const [areGraphsVisible, setAreGraphsVisible] = useState(false);
  const areGraphsVisibleRef = useRef(areGraphsVisible);

  useEffect(() => {
    areGraphsVisibleRef.current = areGraphsVisible;
  }, [areGraphsVisible]);

  useEffect(() => {
    eventLabelRef.current = eventLabel;
  }, [eventLabel]);

  // Add new effect to reset button state when event or pattern tabs change
  useEffect(() => {
    // Reset the graphs visibility state when tabs change
    setAreGraphsVisible(false);
    
    // Also ensure the button text is updated
    if (chartRef.current && chartRef.current.customButtons && chartRef.current.customButtons.toggleGraphsButton) {
      chartRef.current.customButtons.toggleGraphsButton.attr({
        text: 'Show Graphs'
      });
    }
  }, [selectedEvent, selectedPatternIndex]);

  // Add new effect to reset TIRP selection when event or pattern changes
  useEffect(() => {
    // Reset to "No Highlights" when event or pattern changes
    setSelectedTirpIndex(-1);
  }, [selectedEvent, selectedPatternIndex]);

  // Function to dynamically update chart sizing without recreation
  const updateChartSizing = () => {
    if (!chartRef.current) return;
    
    const chartConfig = getChartConfig();
    const chart = chartRef.current;
    
    // Update chart options dynamically
    chart.update({
      chart: {
        marginLeft: chartConfig.marginLeft,
        marginRight: chartConfig.marginRight,
        marginTop: chartConfig.marginTop,
        spacingTop: chartConfig.spacingTop,
        spacingBottom: chartConfig.spacingBottom,
        height: chartConfig.height,
      }
    }, false); // false = don't redraw immediately
    
    // Trigger reflow to apply the new sizing
    chart.reflow();
    chart.redraw();
  };

  // Add separate effect to handle button visibility based on pattern selection
  useEffect(() => {
    //console.log(`[PatternIntervals ${patternIndex}] selectedPatternIndex changed to:`, selectedPatternIndex);
    if (chartRef.current && chartRef.current.customButtons && chartRef.current.customButtons.toggleGraphsButton) {
      // Hide button if selectedPatternIndex is null (All Patterns) or undefined (initial state)
      const shouldHide = selectedPatternIndex === null || selectedPatternIndex === undefined;
      //console.log(`[PatternIntervals ${patternIndex}] shouldHide button:`, shouldHide);
      chartRef.current.customButtons.toggleGraphsButton.attr({
        display: shouldHide ? 'none' : 'block'
      });
    }
    
    // Update chart sizing when pattern context changes
    updateChartSizing();
  }, [selectedPatternIndex]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patternsArray, eventsArray] = await Promise.all([
          DataManagementService.fetchAllPatterns(eventIndex),
          DataManagementService.fetchAllEvents(),
        ]);
        const pattern = patternsArray.find(p => p.index === patternIndex)?.patternData;
        const event = eventsArray.find(e => e.id === eventIndex);
        setEventLabel(formatEventLabel(event?.name, eventIndex));

        if (pattern) {
          // Fetch related temporal property IDs using the service, now passing eventIndex
          const temporalPropertyIds = await DataManagementService.fetchRelatedTemporalPropertyIds(pattern[0], eventIndex);
          setRelatedTemporalPropertyIds(temporalPropertyIds);
          
          // Set the pattern data
          setPatternData(pattern);
        }
      } catch (error) {
        console.error('Error fetching pattern data:', error);
      }
    };
    fetchData();
  }, [patternIndex, eventIndex]);

  const toggleRelatedGraphs = () => {
    if (!relatedTemporalPropertyIds.length) return;
    if (!areGraphsVisibleRef.current) {
      showOnlyGraphs(relatedTemporalPropertyIds, eventIndex);
      setAreGraphsVisible(true);
    } else {
      showOnlyGraphs([], eventIndex); // Hide all graphs for this event
      setAreGraphsVisible(false);
    }
  };

  const timingUnsubscribeRef = useRef(null);

// First effect: Handle chart initialization and pattern data
useEffect(() => {
  if (patternData && relatedTemporalPropertyIds.length > 0 && eventLabel) {
    const [stateIds, categories] = patternData;
    eventRowIndexRef.current = EVENT_ROW_INDEX;

    // Create mappings
    stateMapRef.current = stateIds.reduce((map, stateId, index) => {
      map[stateId] = categories[index];
      return map;
    }, {});

    stateIdToYIndexMapRef.current = stateIds.reduce((map, stateId, index) => {
      map[stateId] = toStateRowIndex(index);
      return map;
    }, {});

    // Ensure real-time mode is active
    isRealTimeRef.current = true;

    // Initialize chart if not already done and not already initialized
    if (!chartRef.current && !chartInitializedRef.current) {
      // console.log(`[PatternIntervals ${patternIndex}] Initializing chart for first time`);
      initializeChart(categories, stateIds, eventLabel);
      chartInitializedRef.current = true;
    }

    // Initialize time references using centralized timing service
    lastDataTimeRef.current = TimingService.getCurrentTimestamp();
    lastDataReceivedTimeRef.current = TimingService.getCurrentTimestamp();

    // Function to process interval deletions based on intervals_to_fix data
    const processIntervalDeletions = (intervalsToFix) => {
      if (!chartRef.current || !relatedTemporalPropertyIds || relatedTemporalPropertyIds.length === 0) {
        return;
      }

      //console.log(`[PatternIntervals ${patternIndex}] Processing interval deletions:`, intervalsToFix);
      //console.log(`[PatternIntervals ${patternIndex}] Related temporal property IDs:`, relatedTemporalPropertyIds);

      // Check if any temporal property IDs in intervals_to_fix match our related ones
      const matchingPropertyIds = Object.keys(intervalsToFix).filter(propertyId => 
        relatedTemporalPropertyIds.includes(parseInt(propertyId))
      );

      if (matchingPropertyIds.length === 0) {
        //console.log(`[PatternIntervals ${patternIndex}] No matching temporal property IDs found for deletion`);
        return;
      }

      const chart = chartRef.current;
      const intervalSeries = chart.series[0]; // The 'Intervals' series
      let intervalsModified = 0;

      // Process each matching temporal property ID
      matchingPropertyIds.forEach(propertyId => {
        const [startTime, endTime] = intervalsToFix[propertyId];
        const startTimeMs = startTime * 1000; // Convert to milliseconds
        const endTimeMs = endTime * 1000;

        //console.log(`[PatternIntervals ${patternIndex}] Processing deletion for property ${propertyId} in time range [${startTimeMs}, ${endTimeMs}]`);

        // Find which y-index (state position) this temporal property ID corresponds to
        const temporalPropertyIdInt = parseInt(propertyId);
        const stateIndex = relatedTemporalPropertyIds.indexOf(temporalPropertyIdInt);
        
        if (stateIndex === -1) {
          console.warn(`[PatternIntervals ${patternIndex}] Temporal property ID ${propertyId} not found in related properties`);
          return;
        }

        const stateId = stateIds[stateIndex];
        const yIndex = stateIdToYIndexMapRef.current[stateId];
        if (yIndex === undefined) return;

        // Find and make transparent intervals that fall within the time range AND belong to this specific state
        intervalSeries.data.forEach((point) => {
          // Only process regular intervals (not pattern-specific ones) that belong to the specific state
          if (point.color === 'rgb(207, 207, 207)' && point.y === yIndex) {
            const intervalStart = point.x;
            const intervalEnd = point.x2;
            
            // Use the same deletion logic as GraphIntervals.jsx
            const intervalCenter = (intervalStart + intervalEnd) / 2;
            const isCompletelyContained = intervalStart >= startTimeMs && intervalEnd <= endTimeMs;
            const isCenterWithinRange = intervalCenter >= startTimeMs && intervalCenter <= endTimeMs;
            
            if (isCompletelyContained || isCenterWithinRange) {
              //console.log(`[PatternIntervals ${patternIndex}] Making interval transparent [${intervalStart}, ${intervalEnd}] (center: ${intervalCenter}) within range [${startTimeMs}, ${endTimeMs}]`);
              
              // Make the interval transparent
              point.update({
                color: 'rgba(0,0,0,0)', // Make transparent
                name: '', // Remove tooltip text
              }, false);
              intervalsModified++;
            }
          }
        });
      });

      if (intervalsModified > 0) {
        //console.log(`[PatternIntervals ${patternIndex}] Made ${intervalsModified} regular intervals transparent`);
        chart.redraw();
      }
    };

    // Callback function to update the chart with incoming data
    const updateData = (data, timestamp, eventPatternsData, intervalsToFix) => {
      // Always update our timing references regardless of chart visibility
      const timestampMs = timestamp * 1000;  // Convert to milliseconds
      lastDataReceivedTimeRef.current = timestampMs;
      lastDataTimeRef.current = timestampMs;

    //  console.log(`[PatternIntervals ${patternIndex}] Received update with timestamp ${timestamp}, eventPatternsData:`, eventPatternsData);

      // Process interval deletions first if we have intervals_to_fix data
      if (intervalsToFix && Object.keys(intervalsToFix).length > 0) {
        processIntervalDeletions(intervalsToFix);
      }

      // DIRECT FIX for pattern 2: If this is pattern 2 and timestamp is 8, forcefully remove all intervals
      // if (patternIndex === 2 && timestamp === 8) {
      //   // console.log(`[PatternIntervals ${patternIndex}] DIRECT FIX: Removing all intervals for pattern 2 at timestamp 8`);
        
      //   if (chartRef.current) {
      //     // Get all intervals for this pattern
      //     const allIntervals = patternOpenIntervalsRef.current.slice();
          
      //     // Remove all intervals from the chart
      //     allIntervals.forEach(interval => {
      //       console.log(`[PatternIntervals ${patternIndex}] DIRECT FIX: Removing interval ${interval.id}`);
      //       if (interval.point && interval.point.remove) {
      //         interval.point.remove(false);
      //       }
      //     });
          
      //     // Clear the interval tracking array
      //     patternOpenIntervalsRef.current = [];
          
      //     // Redraw the chart
      //     chartRef.current.redraw();
      //   }
        
      //   return; // Skip the rest of the processing
      // }

      // Process event patterns data if available - do this regardless of chart visibility
      if (eventPatternsData && Object.keys(eventPatternsData).length > 0) {
      //  console.log(`[PatternIntervals ${patternIndex}] Processing event patterns:`, eventPatternsData);
        processEventPatterns(eventPatternsData);
      } else {
       // console.log(`[PatternIntervals ${patternIndex}] No event patterns to process`);
        
        // IMPORTANT: If there are no event patterns for this pattern, remove all open intervals
        if (chartRef.current) {
          const intervalsToRemove = patternOpenIntervalsRef.current.filter(interval => interval.open);
          
          intervalsToRemove.forEach(interval => {
         //   console.log(`[PatternIntervals ${patternIndex}] Removing interval ${interval.id} as no event patterns available`);
            if (interval.point && interval.point.remove) {
              interval.point.remove(false);
            }
          });
          
          patternOpenIntervalsRef.current = patternOpenIntervalsRef.current.filter(interval => !interval.open);
          chartRef.current.redraw();
        }
      }

      // Only update the chart if it's initialized
      if (chartRef.current) {
        if (Object.keys(data).length > 0) {
          Object.values(data).forEach(stateData => {
            updateChart(stateData);
          });
        } else {
          handleNoNewData(lastDataTimeRef.current);
        }

        // Update all open intervals
        updateOpenHighlightedIntervals();
        updatePatternOpenIntervals();
        updateEventOccurrenceInterval();
      }
    };

    // Set up pattern listener with eventIndex
    webSocketService.addPatternListener(eventIndex, stateIds, updateData);

    // Subscribe to centralized timing service instead of using own interval
    if (timingUnsubscribeRef.current) {
      timingUnsubscribeRef.current();
    }
    
    timingUnsubscribeRef.current = TimingService.subscribeToTimeAdvance((timestamp) => {
      // Update our local time references
      lastDataTimeRef.current = timestamp;
      
      // Only update chart if it's initialized
      if (chartRef.current) {
        handleNoNewData(timestamp);
        // Update all open intervals
        updateOpenHighlightedIntervals();
        updateEventOccurrenceInterval();
      }
    });

    const handleEventOccurredUpdate = (occurred, timestamp) => {
      handleEventOccurred(occurred, timestamp * 1000);
    };
    webSocketService.addEventOccurredListener(eventIndex, handleEventOccurredUpdate);

    return () => {
      webSocketService.removeEventOccurredListener(eventIndex, handleEventOccurredUpdate);
      // Clean up pattern listener
      webSocketService.removePatternListener(eventIndex, stateIds, updateData);
      
      // Unsubscribe from centralized timing service
      if (timingUnsubscribeRef.current) {
        timingUnsubscribeRef.current();
        timingUnsubscribeRef.current = null;
      }
      
      // Clear current intervals
      currentIntervalsRef.current = {};
      
      // Clean up resize handler if it exists
      if (chartRef.current && chartRef.current.customResizeHandler) {
        window.removeEventListener('resize', chartRef.current.customResizeHandler);
      }
    };
  }
}, [patternData, webSocketService, relatedTemporalPropertyIds, eventIndex, eventLabel]);

// Third effect: Handle TIRP subscriptions separately
useEffect(() => {
  if (patternData && relatedTemporalPropertyIds.length > 0) {
    const [stateIds] = patternData;
    
    // Callback to handle TIRP data
    const handleTirpData = (tirpData) => {
      setTirpInstances(tirpData);
    };

    // Set up TIRP listener with consistent key format
    const tirpKey = `${eventIndex}-${patternIndex}`;
    webSocketService.addTirpListener(tirpKey, handleTirpData);
    
    return () => {
      webSocketService.removeTirpListener(tirpKey, handleTirpData);
    };
  }
}, [patternData, webSocketService, patternIndex, eventIndex]);

// Third effect: Handle pattern disappearance
useEffect(() => {
  if (chartRef.current) {
    // Store previous detection tirps data
    const prevDetectionTirpsRef = useRef({});
    
    // Function to check if a pattern has disappeared
    const checkPatternDisappearance = (data) => {
      // Skip if no data
      if (!data || !data[eventIndex]) return;
      
      // Get detection_tirps for this event
      const eventData = data[eventIndex];
      const currentDetectionTirps = eventData.detection_tirps || {};
      
      // Check if pattern existed before but not anymore
      const patternExistedBefore = prevDetectionTirpsRef.current[patternIndex];
      const patternExistsNow = currentDetectionTirps[patternIndex];
      
     // console.log(`[PatternIntervals ${patternIndex}] Pattern existence check: before=${patternExistedBefore}, now=${patternExistsNow}`);
      
      // If pattern disappeared, remove all intervals
      if (patternExistedBefore && !patternExistsNow) {
        //console.log(`[PatternIntervals ${patternIndex}] Pattern disappeared, removing all intervals`);
        
        // Remove all open intervals
        const intervalsToRemove = patternOpenIntervalsRef.current.filter(interval => interval.open);
        
        intervalsToRemove.forEach(interval => {
         // console.log(`[PatternIntervals ${patternIndex}] Removing interval ${interval.id} due to pattern disappearance`);
          if (interval.point && interval.point.remove) {
            interval.point.remove(false);
          }
        });
        
        // Update our tracking array
        patternOpenIntervalsRef.current = patternOpenIntervalsRef.current.filter(interval => !interval.open);
        
        // Redraw the chart
        chartRef.current.redraw();
      }
      
      // Update previous detection tirps
      prevDetectionTirpsRef.current[patternIndex] = patternExistsNow;
    };
    
    // Subscribe to data updates
    const handleNewData = (data) => {
      checkPatternDisappearance(data);
    };
    
    // Add a special listener for pattern disappearance
    webSocketService.addSpecialListener(`pattern-disappearance-${eventIndex}-${patternIndex}`, handleNewData);
    
    return () => {
      webSocketService.removeSpecialListener(`pattern-disappearance-${eventIndex}-${patternIndex}`, handleNewData);
    };
  }
}, [patternIndex, eventIndex, webSocketService]);

// Handle pattern probability
useEffect(() => {
  const key = `${eventIndex}-${patternIndex}`;
  webSocketService.addPatternProbabilityListener(key, setPatternProb);
  return () =>
    webSocketService.removePatternProbabilityListener(key, setPatternProb);
}, [webSocketService, eventIndex, patternIndex]);

  // Add method to map pattern stateIds to temporal property StateIDs
  const mapPatternStateIdToTemporalPropertyStateId = async (patternStateId, temporalPropertyId) => {
    try {
      // Get the states for this temporal property
      const states = await DataManagementService.fetchStates(temporalPropertyId, eventIndex);
      
      // For now, try direct mapping first (might work for some patterns)
      const directMatch = states.find(state => state.StateID === patternStateId);
      if (directMatch) {
        return patternStateId;
      }
      
      // If direct mapping fails, try to find by index
      // This assumes the pattern stateId represents the index in the states array
      if (patternStateId < states.length) {
        return states[patternStateId].StateID;
      }
      
      // Return null if no mapping found (this is expected for some combinations)
      return null;
    } catch (error) {
      console.error(`[PatternIntervals ${patternIndex}] Error mapping stateId ${patternStateId} to temporal property ${temporalPropertyId}:`, error);
      return null;
    }
  };

  // Add method to check if a pattern stateId exists in a temporal property
  const checkPatternStateIdExistsInTemporalProperty = async (patternStateId, temporalPropertyId) => {
    try {
      const states = await DataManagementService.fetchStates(temporalPropertyId, eventIndex);
      const directMatch = states.find(state => state.StateID === patternStateId);
      return directMatch !== undefined;
    } catch (error) {
      console.error(`[PatternIntervals ${patternIndex}] Error checking stateId ${patternStateId} in temporal property ${temporalPropertyId}:`, error);
      return false;
    }
  };

  // Effect to handle TIRP instance selection (predictors)
  useEffect(() => {
    if (chartRef.current) {
      // Always clear any existing highlights first
      clearHighlightedIntervals();
      currentlyHighlightedTirpsRef.current.clear();

      // --- HIGHLIGHT PROPAGATION TO GRAPHS ---
      // Use context to propagate highlights to GraphIntervals
      if (selectedTirpIndex === -1 || selectedTirpIndex === -2) {
        // No predictor or all predictors: clear highlights in all related graphs
        relatedTemporalPropertyIds.forEach(propertyId => {
          // eventIndex is the current event
          setHighlightedIntervals(eventIndex, propertyId, []);
        });
      } else if (selectedTirpIndex >= 0 && selectedTirpIndex < tirpInstances.length) {
        // Specific predictor selected
        const tirpInstance = tirpInstances[selectedTirpIndex];
        // tirpInstance: [events, probability]
        let events = [];
        if (Array.isArray(tirpInstance) && tirpInstance.length === 2) {
          [events] = tirpInstance;
        }
        
        // Build intervals: { stateId, start, end }
        const intervalsByState = {};
        let openByState = {};
        events.forEach(([type, stateId, time]) => {
          // Handle numpy float64 and regular numbers for time
          let timeValue;
          try {
            if (typeof time === 'number') {
              timeValue = time;
            } else if (time && typeof time === 'object' && typeof time.valueOf === 'function') {
              // Handle numpy float64 objects
              timeValue = time.valueOf();
            } else if (typeof time === 'string') {
              timeValue = parseFloat(time);
            } else {
              timeValue = parseFloat(time.toString());
            }
            
            if (isNaN(timeValue)) {
              console.warn(`[PatternIntervals ${patternIndex}] Invalid time value in TIRP processing:`, time);
              return;
            }
          } catch (error) {
            console.warn(`[PatternIntervals ${patternIndex}] Error converting time value in TIRP processing:`, time, error);
            return;
          }
          
          const timeMs = timeValue * 1000;
          if (type === '+') {
            if (!openByState[stateId]) openByState[stateId] = [];
            openByState[stateId].push(timeMs);
          } else if (type === '-') {
            if (openByState[stateId] && openByState[stateId].length > 0) {
              const start = openByState[stateId].shift();
              if (!intervalsByState[stateId]) intervalsByState[stateId] = [];
              intervalsByState[stateId].push({ stateId, start, end: timeMs });
            }
          }
        });
        // Any open intervals (no closing '-')
        Object.entries(openByState).forEach(([stateId, starts]) => {
          starts.forEach(start => {
            if (!intervalsByState[stateId]) intervalsByState[stateId] = [];
            intervalsByState[stateId].push({ stateId: parseInt(stateId), start, end: null });
          });
        });
        
        // For each related property, set highlights with proper state mapping
        const processHighlights = async () => {
          for (const propertyId of relatedTemporalPropertyIds) {
            const mappedIntervals = [];
            
            // For each interval, map the pattern stateId to the temporal property StateID
            for (const [patternStateId, intervals] of Object.entries(intervalsByState)) {
              const patternStateIdInt = parseInt(patternStateId);
              
              // Check if this pattern stateId exists in this temporal property
              const exists = await checkPatternStateIdExistsInTemporalProperty(patternStateIdInt, propertyId);
              
              if (exists) {
                const temporalPropertyStateId = await mapPatternStateIdToTemporalPropertyStateId(patternStateIdInt, propertyId);
                
                if (temporalPropertyStateId !== null) {
                  // Map the intervals to use the temporal property StateID
                  const mappedIntervalsForState = intervals.map(interval => ({
                    ...interval,
                    stateId: temporalPropertyStateId // Use the mapped StateID
                  }));
                  mappedIntervals.push(...mappedIntervalsForState);
                }
              } else {
             //   console.log(`[PatternIntervals ${patternIndex}] Skipping pattern stateId ${patternStateIdInt} for property ${propertyId} - not present in this temporal property`);
              }
            }
            
            setHighlightedIntervals(eventIndex, propertyId, mappedIntervals);
          }
        };
        
        processHighlights();
      }
      // --- END HIGHLIGHT PROPAGATION ---

      // Only proceed if a valid predictor is selected
      if (selectedTirpIndex === -1) {
        // No predictor selected, so we're done
        //console.log(`[PatternIntervals ${patternIndex}] No predictor selected, no highlights applied`);
        return;
      }

      // All predictors or specific predictor
      if (selectedTirpIndex === -2) {
        // All TIRPs selected
        tirpInstances.forEach((tirpInstance, index) => {
          highlightTirpInstance(tirpInstance, index);
          currentlyHighlightedTirpsRef.current.add(index);
        });
      } else if (selectedTirpIndex >= 0 && selectedTirpIndex < tirpInstances.length) {
        // Specific predictor selected
        const tirpInstance = tirpInstances[selectedTirpIndex];
        highlightTirpInstance(tirpInstance, selectedTirpIndex);
        currentlyHighlightedTirpsRef.current.add(selectedTirpIndex);
      }

      // Start updating open highlighted intervals
      updateOpenHighlightedIntervals();
    }
  }, [selectedTirpIndex, tirpInstances]);

  // Add new effect to handle TIRP deletion gracefully
  useEffect(() => {
    if (chartRef.current && selectedTirpIndex !== -1) {
      // Check if currently highlighted TIRPs still exist
      const validHighlightedIndices = Array.from(currentlyHighlightedTirpsRef.current)
        .filter(index => index < tirpInstances.length);
      
      // If some highlighted TIRPs were deleted, update the highlights
      if (validHighlightedIndices.length !== currentlyHighlightedTirpsRef.current.size) {
        //console.log(`[PatternIntervals ${patternIndex}] Some highlighted TIRPs were deleted, refreshing highlights`);
        
        // Clear existing highlights
        clearHighlightedIntervals();
        currentlyHighlightedTirpsRef.current.clear();
        
        // If "All Predictors" was selected, re-highlight all remaining TIRPs
        if (selectedTirpIndex === -2) {
          tirpInstances.forEach((tirpInstance, index) => {
            highlightTirpInstance(tirpInstance, index);
            currentlyHighlightedTirpsRef.current.add(index);
          });
        } 
        // If a specific predictor was selected but no longer exists, clear selection
        else if (selectedTirpIndex >= tirpInstances.length) {
         // console.log(`[PatternIntervals ${patternIndex}] Selected predictor ${selectedTirpIndex} no longer exists, clearing selection`);
          setSelectedTirpIndex(-1);
        }
        // If a specific predictor was selected and still exists, re-highlight it
        else if (selectedTirpIndex >= 0 && selectedTirpIndex < tirpInstances.length) {
          const tirpInstance = tirpInstances[selectedTirpIndex];
          highlightTirpInstance(tirpInstance, selectedTirpIndex);
          currentlyHighlightedTirpsRef.current.add(selectedTirpIndex);
        }
        
        // Start updating open highlighted intervals
        updateOpenHighlightedIntervals();
      }
    }
  }, [tirpInstances.length]); // Only trigger when the number of TIRPs changes

  // Add effect to reset selected predictor when TIRP list becomes empty
  useEffect(() => {
    if (tirpInstances.length === 0 && selectedTirpIndex !== -1) {
      //console.log(`[PatternIntervals ${patternIndex}] TIRP list is empty, resetting selected predictor`);
      setSelectedTirpIndex(-1);
      // Clear any existing highlights
      if (chartRef.current) {
        clearHighlightedIntervals();
      }
    }
  }, [tirpInstances.length, selectedTirpIndex, patternIndex]);

  const initializeChart = (categories, stateIds, label) => {
    const eventRowIndex = EVENT_ROW_INDEX;
    const totalRowCount = stateIds.length + 1;
    eventRowIndexRef.current = eventRowIndex;

    const initialData = [
      {
        x: 0,
        x2: 0,
        y: eventRowIndex,
        name: label,
        color: 'transparent',
        dataLabels: {
          enabled: false,
          format: '{point.name}'
        }
      },
      ...stateIds.map((stateId, index) => ({
        x: 0,
        x2: 0,
        y: toStateRowIndex(index),
        name: categories[index],
        color: 'transparent',
        dataLabels: {
          enabled: false,
          format: '{point.name}'
        }
      })),
    ];

    const chartConfig = getChartConfig();
    const rowPointWidth = Math.max(15, Math.min(20, (chartConfig.height - 120) / totalRowCount * 0.6));
    const options = {
      chart: {
        type: 'xrange',
        marginLeft: chartConfig.marginLeft,
        marginRight: chartConfig.marginRight,
        marginTop: chartConfig.marginTop,
        spacingTop: chartConfig.spacingTop,
        spacingBottom: chartConfig.spacingBottom,
        height: chartConfig.height,
        animation: false, // Disable chart animation
        events: {
          load: function () {
            chartRef.current = this;
            
            // Force 30-second view on initial load
            const chart = this;
            const now = Date.now();
            chart.xAxis[0].setExtremes(now - 30000, now, true, false);

            const updateButtonPositions = () => {
              const chart = chartRef.current;
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
                      const xMin = Math.max(0, xMax - 30000);
                      xAxis.setExtremes(xMin, xMax + 1000, true, true);
                    }
                  })
                  .add();

                  chart.customButtons.toggleGraphsButton = chart.renderer.button(
                    areGraphsVisibleRef.current ? 'Hide Graphs' : 'Show Graphs',
                    chartWidth - 175, 10,
                    function() { // Use the callback parameter instead of .on('click')
                      const willShow = !areGraphsVisibleRef.current;
                      toggleRelatedGraphs();
                      
                      // Update button text using the button reference
                      chart.customButtons.toggleGraphsButton.attr({
                        text: willShow ? 'Hide Graphs' : 'Show Graphs'
                      });
                    },
                    { width: 80, style: { textAlign: 'center' } },
                    { width: 80, style: { textAlign: 'center' } }
                  )
                    .attr({ zIndex: 3, height: 6 })
                    .add();
                
                // Set initial visibility based on pattern selection
                const shouldHide = selectedPatternIndex === null || selectedPatternIndex === undefined;
                chart.customButtons.toggleGraphsButton.attr({
                  display: shouldHide ? 'none' : 'block'
                });
              } else {
                chart.customButtons.realTimeButton.attr({ x: chartWidth - 75 });
                chart.customButtons.toggleGraphsButton.attr({
                  x: chartWidth - 175,
                  text: areGraphsVisibleRef.current ? 'Hide Graphs' : 'Show Graphs',
                  width: 80
                });
              }
            };

            updateButtonPositions();

            chartRef.current.redraw = function () {
              Highcharts.Chart.prototype.redraw.call(this);
              updateButtonPositions();
            };

            const handleResize = function () {
              if (chartRef.current && chartRef.current.reflow) {
                // Update chart sizing based on current context
                updateChartSizing();
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
        // text: `Pattern ${patternIndex + 1}: ${categories.join(', ')}`,
        align: 'left',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
        },
        y: 15
      },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime',
        title: { text: '' },
        labels: getXAxisLabelsConfig(),
        min: null,
        max: null,
        events: {
          setExtremes: function (e) {
            if (e.trigger !== 'syncExtremes') {
              isRealTimeRef.current = false;
            }
          }
        }
      },
      yAxis: [{
        title: { text: '', align: 'high', offset: 0, rotation: 0, y: -10, x: -50 },
        categories: [label, ...categories],
        reversed: true,
        opposite: false,
        labels: {
          align: 'right',
          x: -10,
          style: { fontSize: '12px' }
        },
        lineWidth: 1
      }],
      rangeSelector: {
        enabled: true,
        buttons: [{ count: 30, type: 'second', text: '30s' }, { count: 1, type: 'minute', text: '1m' }, { type: 'all', text: 'All' }],
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
          animation: false // Disable animation for all series
        },
        xrange: {
          grouping: false,
          animation: false // Disable animation for xrange specifically
        }
      },
      series: [
        {
          name: 'Intervals',
          data: initialData,
          colorByPoint: false,
          pointWidth: rowPointWidth,
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
          animation: false, // Disable animation for this series
          borderRadius: 0, 
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
        },
        {
          name: 'Highlights',
          data: [],
          colorByPoint: false,
          pointWidth: rowPointWidth,
          zIndex: 2, // Ensure this series is drawn above the intervals
          grouping: false,
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
          animation: false // Disable animation for this series
        },
        {
          name: 'Event Occurred',
          data: [],
          colorByPoint: false,
          color: EVENT_OCCURRED_COLOR,
          pointWidth: Math.max(rowPointWidth, (chartConfig.height - 120) / totalRowCount * 0.99),
          zIndex: 3,
          borderWidth: 0,
          pointPadding: 0,
          groupPadding: 0,
          animation: false,
          borderRadius: 0,
          tooltip: { enabled: false, pointFormatter: () => "" },
          enableMouseTracking: false,
        }
      ]
    };

    Highcharts.stockChart(graphId, options);
  };

  const updateChart = (data) => {
    const chart = chartRef.current;
    if (!chart) return;

    const series = chart.series[0]; // Intervals series
    const time = data.time * 1000;  // Use WebSocket timestamp
    const stateId = parseInt(data.state_id);

    // Use the mappings to get the label and yIndex
    const stateLabel = stateMapRef.current[stateId];
    const y = stateIdToYIndexMapRef.current[stateId];

    if (y === undefined) return; // Skip if the state is not part of this pattern

    if (currentIntervalsRef.current[y]) {
      currentIntervalsRef.current[y].update({
        x2: time + 1000
      }, false);
    } else {
      const newPoint = {
        x: time,
        x2: time + 1000,
        y: y,
        name: stateLabel,
        color: 'rgb(207, 207, 207)'
      };
      currentIntervalsRef.current[y] = series.addPoint(newPoint, false);
    }

    chart.redraw();

    if (isRealTimeRef.current) {
      const lastPoint = series.points[series.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
    
    // Ensure the initial data rendering includes proper time window
    if (isRealTimeRef.current && lastDataTimeRef.current > 30000) {
      const currentTime = lastDataTimeRef.current;
      chart.xAxis[0].setExtremes(currentTime - 30000, currentTime + 1000, true, true);
    }
  };

  const handleNoNewData = (timestamp) => {
    const chart = chartRef.current;
    if (!chart) return;

    const series = chart.series[0];

    // For each state plus the event row, add a blank placeholder point for the current time
    const yIndices = [
      ...Object.values(stateIdToYIndexMapRef.current),
      eventRowIndexRef.current,
    ];

    yIndices.forEach((yIndex) => {
      const newPoint = {
        x: timestamp,
        x2: timestamp + 1000,
        y: yIndex,
        name: '',
        color: 'transparent'
      };

      currentIntervalsRef.current[yIndex] = series.addPoint(newPoint, false);
    });

    chart.redraw();

    // Keep advancing the X-axis in real-time even when there is no data
    if (isRealTimeRef.current) {
      const lastPoint = series.points[series.points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
    
    // Update pattern open intervals
    updatePatternOpenIntervals();
  };

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
            y: eventRowIndexRef.current,
            name: eventLabelRef.current,
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

  const updateEventOccurrenceInterval = () => {
    if (!eventOccurrenceRef.current?.open || lastDataTimeRef.current === null) return;

    const chart = chartRef.current;
    if (!chart || !eventOccurrenceRef.current.point?.update) return;

    const endTime = lastDataTimeRef.current + 1000;
    try {
      eventOccurrenceRef.current.point.update({ x2: endTime }, false);
      chart.redraw();
    } catch (error) {
      console.error(`[PatternIntervals ${patternIndex}] Failed to update event occurrence interval:`, error);
    }
  };

  // Function to update open highlighted intervals
  const updateOpenHighlightedIntervals = () => {
    if (openIntervalsRef.current && lastDataTimeRef.current !== null) {
      let updated = false;
      
      Object.values(openIntervalsRef.current).forEach(intervalArray => {
        intervalArray.forEach(interval => {
          if (interval && !interval.x2) { // Only update if interval is open (no x2 set)
            interval.x2 = lastDataTimeRef.current + 1000;
            updated = true;
          }
        });
      });
      
      if (updated && chartRef.current) {
        // Re-render the highlights series with updated intervals
        const series = chartRef.current.series[1];
        const allIntervals = [];
        
        // Collect all intervals (both closed and open)
        series.data.forEach(point => {
          if (point.x2 && point.x2 !== lastDataTimeRef.current + 1000) {
            // This is a closed interval, keep as is
            allIntervals.push({
              x: point.x,
              x2: point.x2,
              y: point.y,
              name: point.name,
              color: point.color
            });
          }
        });
        
        // Add all open intervals with updated x2
        Object.values(openIntervalsRef.current).forEach(intervalArray => {
          intervalArray.forEach(interval => {
            allIntervals.push(interval);
          });
        });
        
        series.setData(allIntervals, false);
        chartRef.current.redraw();
      }
    }
  };

  // In the createOpenInterval function, fix the color format
  const createOpenInterval = (startTime, intervalId) => {
    const chart = chartRef.current;
    if (!chart) return;

    //console.log(`[PatternIntervals ${patternIndex}] Creating open interval at ${startTime} with id ${intervalId}`);

    // Add the point without redrawing immediately
    chart.series[0].addPoint(
      {
        x: startTime,
        x2: startTime + 1000, // Initial extension, will be updated
        y: FIRST_STATE_ROW_INDEX, // First state row below the event row
        name: `Pattern ${patternIndex} Interval`,
        color: 'rgba(207, 207, 207, 0.9)', // Use gray color with alpha
        tooltip: { enabled: false, pointFormatter: () => "" },
        enableMouseTracking: false,
      },
      false
    );
    
    // Redraw the chart so that the point is rendered
    chart.redraw();

    // Retrieve the newly added point from the series data
    const seriesData = chart.series[0].data;
    const newPoint = seriesData[seriesData.length - 1];

    // Store the open interval with its unique id
    patternOpenIntervalsRef.current.push({
      id: intervalId,
      point: newPoint,
      startTime,
      open: true,
    });

    // Shift the x-axis if in real-time mode
    if (isRealTimeRef.current) {
      const lastPoint = chart.series[0].points[chart.series[0].points.length - 1];
      if (lastPoint) {
        chart.xAxis[0].setExtremes(lastPoint.x - 30000, lastPoint.x + 1000, true, true);
      }
    }
  };

  // Update the processEventPatterns function to track all active intervals and handle deletions
  const processEventPatterns = (eventPatternsData) => {
    if (!eventPatternsData) {
      //console.log(`[PatternIntervals ${patternIndex}] No event patterns data provided`);
      
      // If no event patterns data is provided, clear all open intervals
      if (chartRef.current) {
        const intervalsToRemove = patternOpenIntervalsRef.current.filter(interval => interval.open);
        
        intervalsToRemove.forEach(interval => {
         // console.log(`[PatternIntervals ${patternIndex}] Removing interval ${interval.id} as no event patterns data provided`);
          if (interval.point && interval.point.remove) {
            interval.point.remove(false);
          }
        });
        
        patternOpenIntervalsRef.current = patternOpenIntervalsRef.current.filter(interval => !interval.open);
        chartRef.current.redraw();
      }
      
      return;
    }
    
    try {
    //  console.log(`[PatternIntervals ${patternIndex}] Processing event patterns:`, eventPatternsData);
      
      // Track which interval IDs are still active in this data batch
      const activeIntervalIds = new Set();
      
      // Check if the current pattern exists in the event patterns data
      const currentPatternData = eventPatternsData[patternIndex];
      if (!currentPatternData || !Array.isArray(currentPatternData) || currentPatternData.length === 0) {
       // console.log(`[PatternIntervals ${patternIndex}] Pattern ${patternIndex} not found in event patterns data, removing all intervals`);
        
        // Pattern not found in data, remove all open intervals
        if (chartRef.current) {
          const intervalsToRemove = patternOpenIntervalsRef.current.filter(interval => interval.open);
          
          intervalsToRemove.forEach(interval => {
            //console.log(`[PatternIntervals ${patternIndex}] Removing interval ${interval.id} as pattern not found in data`);
            if (interval.point && interval.point.remove) {
              interval.point.remove(false);
            }
          });
          
          patternOpenIntervalsRef.current = patternOpenIntervalsRef.current.filter(interval => !interval.open);
          chartRef.current.redraw();
        }
        
        return;
      }
      
      // Process each pattern's data
      Object.entries(eventPatternsData).forEach(([patternIdStr, patternData]) => {
        try {
          const patternId = parseInt(patternIdStr, 10);
          
          // Only process if this is the current pattern
          if (patternId !== patternIndex) {
           // console.log(`[PatternIntervals ${patternIndex}] Pattern ID ${patternId} doesn't match current pattern ${patternIndex}, skipping`);
            return;
          }
          
          // Skip if pattern data is not available or empty
          if (!patternData || !Array.isArray(patternData) || patternData.length === 0) {
            //console.log(`[PatternIntervals ${patternIndex}] No valid pattern data for pattern ${patternId}`);
            return;
          }

          // Process each TIRP instance in this pattern
          patternData.forEach(tirpInstance => {
            if (
              !Array.isArray(tirpInstance)
              || tirpInstance.length < 2
              || !Array.isArray(tirpInstance[0])
            ) {
              //console.warn(
              //  `[PatternIntervals ${patternIndex}] Invalid TIRP instance format:`,
              //  tirpInstance
              //);
              return;
            }
            
            // Extract events array from the TIRP instance
            const [events] = tirpInstance;
            
            if (!Array.isArray(events)) {
              console.warn(`[PatternIntervals ${patternIndex}] Invalid events format:`, events);
              return;
            }
            
            // Process each event
            events.forEach(event => {
              // Handle both array format [type, stateId, time] and unexpected formats
              if (!Array.isArray(event)) {
                // Skip non-array events (e.g., simple numbers) silently
                return;
              }
              
              if (event.length < 3) {
                console.warn(`[PatternIntervals ${patternIndex}] Invalid event format - insufficient elements:`, event);
                return;
              }
              
              const [type, stateId, time] = event;
              
              // Handle numpy float64 and regular numbers for time
              let timeValue;
              try {
                if (typeof time === 'number') {
                  timeValue = time;
                } else if (time && typeof time === 'object' && typeof time.valueOf === 'function') {
                  // Handle numpy float64 objects
                  timeValue = time.valueOf();
                } else if (typeof time === 'string') {
                  timeValue = parseFloat(time);
                } else {
                  timeValue = parseFloat(time.toString());
                }
                
                // Validate the converted time value
                if (isNaN(timeValue)) {
                  console.warn(`[PatternIntervals ${patternIndex}] Invalid time value:`, time);
                  return;
                }
              } catch (error) {
                console.warn(`[PatternIntervals ${patternIndex}] Error converting time value:`, time, error);
                return;
              }
              
              // For type '+', create a new interval or update existing
              if (type === '+') {
                // Generate a unique interval ID based on stateId and timestamp
                const intervalId = `${stateId}-${timeValue}`;
                activeIntervalIds.add(intervalId);
                
                // Check if this interval already exists
                const exists = patternOpenIntervalsRef.current.some(
                  (interval) => interval.id === intervalId
                );
                
                if (!exists) {
                  // Convert time to milliseconds
                  const timeMs = typeof timeValue === 'number' 
                    ? timeValue * 1000 
                    : parseFloat(timeValue.toString()) * 1000;
                  
                  //console.log(`[PatternIntervals ${patternIndex}] Adding interval ${intervalId} at ${timeMs}`);
                  
                  if (chartRef.current) {
                    createOpenInterval(timeMs, intervalId);
                  } else {
                    pendingPatternIntervalsRef.current.adding.push({
                      id: intervalId,
                      timestamp: timeMs
                    });
                  }
                }
              }
              // For type '-', close the interval
              else if (type === '-') {
                // Find the corresponding open interval
                const stateIdStr = stateId.toString();
                const timeMs = typeof timeValue === 'number' 
                  ? timeValue * 1000 
                  : parseFloat(timeValue.toString()) * 1000;
                
                // Find the specific interval to close using the exact match
                const matchingEvent = events.find(e => Array.isArray(e) && e.length >= 3 && e[0] === '+' && e[1] === stateId);
                const matchingTime = matchingEvent ? matchingEvent[2] : null;
                
                // Handle numpy float64 for matching time
                let matchingTimeValue = null;
                if (matchingTime !== null) {
                  try {
                    if (typeof matchingTime === 'number') {
                      matchingTimeValue = matchingTime;
                    } else if (matchingTime && typeof matchingTime === 'object' && typeof matchingTime.valueOf === 'function') {
                      matchingTimeValue = matchingTime.valueOf();
                    } else {
                      matchingTimeValue = parseFloat(matchingTime.toString());
                    }
                  } catch (error) {
                    console.warn(`[PatternIntervals ${patternIndex}] Error converting matching time value:`, matchingTime, error);
                  }
                }
                
                const matchingIntervalId = matchingTimeValue !== null ? `${stateId}-${matchingTimeValue}` : null;
                
                // Add all closed intervals to activeIntervalIds to prevent them from being removed
                if (matchingIntervalId) {
                  activeIntervalIds.add(matchingIntervalId);
                }
                
                // Find intervals that match this stateId that are still open
                const matchingIntervals = patternOpenIntervalsRef.current.filter(
                  interval => interval.id.startsWith(`${stateIdStr}-`) && interval.open
                );
                
                matchingIntervals.forEach(interval => {
                  //console.log(`[PatternIntervals ${patternIndex}] Closing interval ${interval.id} at ${timeMs}`);
                  
                  if (interval.point && interval.point.update) {
                    // Update the interval to end at the current time
                    interval.point.update({ x2: timeMs }, false);
                    interval.open = false; // Mark as closed
                  }
                });
              }
            });
          });
        } catch (error) {
          console.error(`[PatternIntervals ${patternIndex}] Error processing pattern ${patternIdStr}:`, error);
        }
      });
      
      // Now actually remove intervals that are no longer in the active TIRP list
      if (chartRef.current) {
        // Find intervals to remove (not in activeIntervalIds)
        const intervalsToRemove = patternOpenIntervalsRef.current.filter(
          interval => interval.open && !activeIntervalIds.has(interval.id)
        );
        
        if (intervalsToRemove.length > 0) {
          //console.log(`[PatternIntervals ${patternIndex}] Found ${intervalsToRemove.length} intervals to remove that are no longer active`);
          
          // Remove these intervals from the chart
          intervalsToRemove.forEach(interval => {
            //console.log(`[PatternIntervals ${patternIndex}] Removing interval ${interval.id} as it's no longer active`);
            if (interval.point && interval.point.remove) {
              interval.point.remove(false);
            }
          });
          
          // Remove from our tracking array
          patternOpenIntervalsRef.current = patternOpenIntervalsRef.current.filter(
            interval => !interval.open || activeIntervalIds.has(interval.id)
          );
          
          // Redraw the chart
          chartRef.current.redraw();
        }
      }
    } catch (error) {
      console.error(`[PatternIntervals ${patternIndex}] Error in processEventPatterns:`, error, eventPatternsData);
    }
  };

  // Update the updatePatternOpenIntervals function to not extend intervals that should be removed
  const updatePatternOpenIntervals = () => {
    if (!chartRef.current || lastDataTimeRef.current === null) return;
    
    const endTime = lastDataTimeRef.current + 1000;
    let updated = false;
    
    patternOpenIntervalsRef.current.forEach((entry) => {
      if (entry.open && entry.point && entry.point.update) {
        try {
          entry.point.update({ x2: endTime }, false);
          updated = true;
        } catch (error) {
          console.error(`Failed to update interval for pattern ${patternIndex}, id ${entry.id}:`, error);
        }
      }
    });
    
    if (updated) {
      chartRef.current.redraw();
    }
  };

  // Add a utility function to check and update TIRP instances
  useEffect(() => {
    // This effect will run whenever we receive a new data update
    // It will handle the case where a pattern should be removed when it no longer exists
    if (chartRef.current) {
      const checkTirpRemoval = () => {
        const eventDataMap = webSocketService.getLatestEventData();
        if (!eventDataMap) return;
        
        // Get data for current event
        const eventData = eventDataMap[eventIndex];
        if (!eventData) return;
        
        // Check if the detection_tirps for this pattern exists
        if (!eventData.detection_tirps || !eventData.detection_tirps[patternIndex]) {
          //console.log(`[PatternIntervals ${patternIndex}] Pattern not in latest data, clearing intervals`);
          
          // Remove all open intervals for this pattern
          const intervalsToRemove = patternOpenIntervalsRef.current.filter(interval => interval.open);
          
          intervalsToRemove.forEach(interval => {
            //console.log(`[PatternIntervals ${patternIndex}] Removing interval ${interval.id} from latest check`);
            if (interval.point && interval.point.remove) {
              interval.point.remove(false);
            }
          });
          
          // Remove from tracking array
          patternOpenIntervalsRef.current = patternOpenIntervalsRef.current.filter(interval => !interval.open);
          
          // Redraw the chart
          chartRef.current.redraw();
        }
      };
      
      // Run check now
      checkTirpRemoval();
      
      // Set up interval to check periodically
      const checkInterval = setInterval(checkTirpRemoval, 1000);
      
      return () => {
        clearInterval(checkInterval);
      };
    }
  }, [patternIndex, eventIndex, webSocketService]);

  // Update the clearHighlightedIntervals function to also clear pattern intervals
  const clearHighlightedIntervals = () => {
    const chart = chartRef.current;
    if (!chart) return;
    
    const highlightSeries = chart.series[1]; // Highlights series
    
    // Remove all points from the highlights series
    highlightSeries.setData([], false);
    highlightedIntervalsRef.current = [];
    openIntervalsRef.current = {}; // Clear open intervals
    currentlyHighlightedTirpsRef.current.clear(); // Clear tracking of highlighted TIRPs
    
    chart.redraw();
  };

  // Updated highlightTirpInstance to handle the new format and include TIRP index for better tracking
  const highlightTirpInstance = (tirpInstance, tirpIndex = null) => {
    if (!tirpInstance) {
      console.warn(`[PatternIntervals ${patternIndex}] Cannot highlight null TIRP instance`);
      return;
    }
    
    // Handle the new format: tirpInstance is now a tuple with [events, probability]
    // where events is an array of [type, stateId, time] arrays
    let events = [];
    let probability = 0;
    
    // Check if this is the new format (tuple with events and probability)
    if (Array.isArray(tirpInstance) && tirpInstance.length === 2) {
      [events, probability] = tirpInstance;
    } else {
      console.warn(`[PatternIntervals ${patternIndex}] Unknown TIRP format:`, tirpInstance);
      return;
    }
    
    // Always use blue color for all highlighting scenarios
    const highlightColor = 'rgba(103, 136, 168, 0.80)';
  
    const series = chartRef.current.series[1]; // Highlights series
    let intervals = [...series.data.map(point => ({ // Preserve existing intervals
      x: point.x,
      x2: point.x2,
      y: point.y,
      name: point.name,
      color: point.color
    }))]; 
    
    const openIntervals = {...openIntervalsRef.current}; // Preserve existing open intervals
    
    events.forEach(([type, stateId, time]) => {
      const yIndex = stateIdToYIndexMapRef.current[stateId];
      if (yIndex === undefined) return;

      // Handle numpy float64 and regular numbers for time
      let timeValue;
      try {
        if (typeof time === 'number') {
          timeValue = time;
        } else if (time && typeof time === 'object' && typeof time.valueOf === 'function') {
          // Handle numpy float64 objects
          timeValue = time.valueOf();
        } else if (typeof time === 'string') {
          timeValue = parseFloat(time);
        } else {
          timeValue = parseFloat(time.toString());
        }
        
        if (isNaN(timeValue)) {
          console.warn(`[PatternIntervals ${patternIndex}] Invalid time value in highlight processing:`, time);
          return;
        }
      } catch (error) {
        console.warn(`[PatternIntervals ${patternIndex}] Error converting time value in highlight processing:`, time, error);
        return;
      }
      
      const timeMs = timeValue * 1000;
  
      const intervalKey = `${stateId}-${tirpIndex !== null ? tirpIndex : 'unknown'}`;
  
      if (type === '+') {
        // Start a new interval
        if (!openIntervals[intervalKey]) {
          openIntervals[intervalKey] = [];
        }
        
        const newInterval = {
          x: timeMs,
          y: yIndex,
          name: stateMapRef.current[stateId],
          color: highlightColor,
          tirpIndex: tirpIndex // Store TIRP index for tracking
        };
        
        openIntervals[intervalKey].push(newInterval);
      } else if (type === '-') {
        // Close the interval
        if (openIntervals[intervalKey] && openIntervals[intervalKey].length > 0) {
          const interval = openIntervals[intervalKey].shift(); // Remove first (FIFO)
          interval.x2 = timeMs; // Set end time
          intervals.push(interval);
        }
      }
    });
  
    // For any intervals that are still open, set x2 to lastDataTimeRef.current + 1000
    Object.entries(openIntervals).forEach(([key, intervalArray]) => {
      intervalArray.forEach(interval => {
        if (!interval.x2) { // Only if not already closed
          interval.x2 = (lastDataTimeRef.current !== null ? lastDataTimeRef.current + 1000 : interval.x + 1000);
          intervals.push(interval);
        }
      });
    });
  
    // Update the series data
    series.setData(intervals, false);
  
    // Redraw the chart
    chartRef.current.redraw();
    
    // Update the open intervals ref
    openIntervalsRef.current = openIntervals;
  };

  return (
    <div>
    <div style={{ 
      marginBottom: '10px',
      display: 'flex',
      justifyContent: 'space-between', // This pushes items to opposite ends
      alignItems: 'center' // This vertically centers the items
    }}>
      {/* Title on the left */}
      {/* <h3 style={{ margin: 0, fontSize: '16px' }}>
        Pattern {patternIndex}
      </h3> */}


      {/* added new ? */}
      <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
          <h3 style={{margin: 0, fontSize: '16px'}}>
            Pattern {patternIndex}
          </h3>

          <PatternModal
            patternId={patternIndex}
            eventId={eventIndex}
            triggerLabel={<FaRegQuestionCircle className="w-4 h-4 text-blue-600 hover:text-blue-800" />}
          />
        </div>

      {/* Predictor selector in the middle */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <label 
          htmlFor={`tirp-picker-${graphId}`}
          style={{ marginRight: '10px' }}
        >
          Highlight Predictor:
        </label>
        <select
          id={`tirp-picker-${graphId}`}
          value={selectedTirpIndex}
          onChange={(e) => {
            setSelectedTirpIndex(parseInt(e.target.value));
          }}
        >
          <option value={-1}>No Highlights</option>
          <option value={-2}>All Predictors</option>
          {tirpInstances.map((tirpInstance, index) => {
            // Extract the start timestamp from the first event
            let predictorName = `Predictor ${index + 1}`;
            try {
              if (Array.isArray(tirpInstance) && tirpInstance.length >= 1) {
                const [events] = tirpInstance;
                if (Array.isArray(events) && events.length > 0) {
                  const firstEvent = events[0];
                  if (Array.isArray(firstEvent) && firstEvent.length >= 3) {
                    const timestamp = firstEvent[2];
                    
                    // Handle numpy float64 and regular numbers
                    let timeValue;
                    if (typeof timestamp === 'number') {
                      timeValue = timestamp;
                    } else if (timestamp && typeof timestamp === 'object' && typeof timestamp.valueOf === 'function') {
                      // Handle numpy float64 objects
                      timeValue = timestamp.valueOf();
                    } else if (typeof timestamp === 'string') {
                      timeValue = parseFloat(timestamp);
                    } else {
                      timeValue = parseFloat(timestamp.toString());
                    }
                    
                    if (!isNaN(timeValue)) {
                      // Convert seconds to MM:SS format
                      const minutes = Math.floor(timeValue / 60);
                      const seconds = Math.floor(timeValue % 60);
                      const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                      
                      predictorName = `Predictor ${formattedTime}`;
                    }
                  }
                }
              }
            } catch (error) {
              console.warn(`Error extracting timestamp for predictor ${index}:`, error);
            }
            
            return (
              <option key={index} value={index}>
                {predictorName}
              </option>
            );
          }).reverse()}
        </select>
      </div>

      {/* Pattern probability on the right */}
      <div style={{
        marginRight: '30px',
        fontWeight: 'bold',
        fontSize: '16px',
        minWidth: '130px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <span style={{marginRight: '5px'}}>Probability:</span>
        <span style={{
          width: '50px',
          textAlign: 'right',
          transition: 'color 0.3s ease'
        }}>
          {patternProb !== undefined ? `${(patternProb * 100).toFixed(1)}%` : '0.0%'}
        </span>
      </div>

      
    </div>
      <div
        id={graphId}
        style={{
          height: `${230 + EVENT_ROW_EXTRA_HEIGHT}px`,
          width: '100%',
          border: '2px solid #CCCCCC', //#7F7F7F',
          borderRadius: '4px',
          padding: '5px',
          margin: '0',
          marginBottom: '0px',
          // marginRight: '300px',
          boxSizing: 'border-box',
          backgroundColor: '#FFFFFF'
        }}
      ></div>
    </div>
  );
}