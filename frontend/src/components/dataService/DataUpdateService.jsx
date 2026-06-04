import API_BASE_URL from '../../config';
import TimingService from './TimingService';
import { normalizeProbability } from '../../utils/probabilityUtils';

class DataUpdateService {
  constructor() {
    this.listeners = {};
    this.dataStore = {};
    this.patternListeners = {};
    this.tirpListeners = {};
    this.probabilityListeners = {};
    this.patternProbabilityListeners = {};
    this.tteListeners = {};
    this.eventActiveListeners = {}; // Add event active listeners collection
    this.eventOccurredListeners = {};
    this.specialListeners = {}; // Add special listeners collection
    this.timestampListeners = {}; // Add timestamp listeners for graph progression
    this.pendingDeletions = {}; // Track pending deletions for properties without data yet
    this.lastKnownTimestamp = null;
    this.lastDetectionTirps = {}; // Track detection_tirps for each event
    this.intervalId = null;
    this.isRunning = false;
    this.missedFetchCount = 0; // Counter for missed updates
    this.MAX_MISSED_FETCHES = 5; // Maximum allowed missed fetches
    this.fetchCount = 0; // Counter for fetch calls
    this.FAST_FETCH_COUNT = 1; // Number of fast fetches before slowing down
    this.FAST_INTERVAL = 100; // 100ms for fast fetches (network-friendly)
    this.fastFetchCompleteDispatched = false; // Track if fast phase completion event was sent
    this.runFastFetches = false; // Flag to control fast fetch loop
    this.NORMAL_INTERVAL = 3000; // 10000ms (10 seconds) for normal fetches
    this.isFetching = false; // Track if a fetch is currently in progress
    
    // User study mode settings
    this.userStudyMode = true; // Flag to enable user study mode
    this.MAX_FETCH_LIMIT = 90; // Maximum number of fetches allowed in user study mode

    // Track successive connect / disconnect cycles so we can ignore
    // any fetch responses that belong to an older (now obsolete) session.
    this.sessionVersion = 0;
  }

  connect() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.fetchCount = 0; // reset fetch counter on every connect
    this.fastFetchCompleteDispatched = false; // reset dispatch flag on new connect

    // Bump the session version so that any still-in-flight requests from a
    // previous cycle can be distinguished and ignored when they resolve.
    this.sessionVersion += 1;
    const thisConnectVersion = this.sessionVersion;
    // console.log('Starting data updates with fast interval...');
    const sessionId = sessionStorage.getItem('session_id');

    // Initialize the session
    fetch(`${API_BASE_URL}/reset_session?session_id=${sessionId}`, {
      method: 'POST'
    }).then(() => {
      console.log("Session reset before starting");
      this.lastKnownTimestamp = null; // Reset timestamp on session reset
      
      // Initialize centralized timing service
      TimingService.initialize(0);
      
      this.runFastFetches = true;
      this.fetchData(); // Start the fetch loop
    });

    // Define the fetch function outside of intervals to control execution flow
    this.fetchData = async () => {
      // Bail out immediately if this call belongs to an older session.
      if (thisConnectVersion !== this.sessionVersion) return;
      if (!this.isRunning) return;
      
      // Prevent overlapping fetches - critical for network stability
      if (this.isFetching) {
        console.warn('Fetch already in progress, skipping this call');
        return;
      }
      
      this.isFetching = true;
      const fetchStartTime = Date.now();

      try {
        const sessionId = sessionStorage.getItem('session_id');
        const response = await fetch(`${API_BASE_URL}/continuous_data?session_id=${sessionId}`);

        // Abort processing if a newer session has started while we were waiting
        if (thisConnectVersion !== this.sessionVersion) return;

        // Check for 204 No Content response first
        if (response.status === 204) {
          this.missedFetchCount++;
          const expectedNext = this.lastKnownTimestamp !== null ? this.lastKnownTimestamp + 1 : 'Unknown';
          console.log(`No new data available (204). Count: ${this.missedFetchCount}.`);
          
          if (this.missedFetchCount >= 3) {
            console.log(`No new data received for 3 consecutive fetches. Stopping updates. Last known timestamp: ${this.lastKnownTimestamp || 'None'}.`);
            this.isFetching = false;
            this.disconnect();
            return; // Exit early
          }
          
          this.isFetching = false;
          // Schedule next fetch AFTER processing this response
          this.scheduleNextFetch();
          return;
        }

        if (!response.ok) {
          this.missedFetchCount++;
          console.log(`Request failed with status ${response.status}. Missed fetch count: ${this.missedFetchCount}`);
          if (this.missedFetchCount >= this.MAX_MISSED_FETCHES) {
            console.log(`Request failed for ${this.MAX_MISSED_FETCHES} consecutive fetches. Stopping updates.`);
            this.isFetching = false;
            this.disconnect();
            const resetSession = async () => {
              const sessionId = localStorage.getItem('session_id');
              await fetch(`${API_BASE_URL}/reset_session?session_id=${sessionId}`, {
                method: 'POST',
              });
              this.lastKnownTimestamp = null; // Reset timestamp on session reset
            };
            return; // Exit early
          }
          
          this.isFetching = false;
          // Schedule next fetch AFTER processing this response
          this.scheduleNextFetch();
          return;
        }
        
        const data = await response.json();
        
        const fetchDuration = Date.now() - fetchStartTime;
        console.log(`Fetch #${this.fetchCount + 1} completed in ${fetchDuration}ms`);

        // Increment fetch counter
        this.fetchCount++;

        // Check if we've reached the maximum fetch limit in user study mode
        if (this.userStudyMode && this.fetchCount >= this.MAX_FETCH_LIMIT) {
          console.log(`Reached maximum fetch limit (${this.MAX_FETCH_LIMIT}) in user study mode. Stopping updates.`);
          this.isFetching = false;
          this.disconnect();
          return;
        }

        // Process each event in the data – but only if we are still on the
        // same session. (Another guard for extra safety.)
        if (thisConnectVersion !== this.sessionVersion) return;

        // Process each event in the data
        if (data && Object.keys(data).length > 0) {
          this.missedFetchCount = 0; // Reset missed fetch counter
          
          // Get the latest timestamp from the actual data
          let latestTimestamp = null;

          // Process each event in the data
          Object.entries(data).forEach(([eventId, eventData]) => {
            // Always notify listeners with timestamp, even if entity_data is empty
            if (eventData && eventData.timestamp !== undefined) {
              // Track the latest timestamp from the data
              if (latestTimestamp === null || eventData.timestamp > latestTimestamp) {
                latestTimestamp = eventData.timestamp;
              }
              
              // Check for null/undefined event_patterns and convert to empty object if needed
              const safeEventPatterns = eventData.event_patterns || {};
              
              // Handle intervals_to_fix - extract and prepare for listeners
              const intervalsToFix = eventData.intervals_to_fix || {};
              
              // Only update data store if we have actual entity_data
              if (eventData.entity_data && Object.keys(eventData.entity_data).length > 0) {
                // Debug: Log event_patterns for debugging
                //console.log(`[DataUpdateService] Event ${eventId} received event_patterns:`, eventData.event_patterns);
                
                // Update data store for this event
                this.updateDataStore(eventId, eventData.entity_data);
              }
              
              // ALWAYS remove intervals from data store based on intervals_to_fix
              // This ensures deletions are applied even when graphs are hidden
              if (Object.keys(intervalsToFix).length > 0) {
                //console.log(`[DataUpdateService] Processing intervals_to_fix for event ${eventId}:`, intervalsToFix);
              }
              this.removeIntervalsFromDataStore(eventId, intervalsToFix);
              
              // Always notify listeners with timestamp - this ensures graphs progress even with empty entity_data
              this.notifyListeners(
                eventId,
                eventData.entity_data || {}, // Use empty object if no entity_data
                eventData.timestamp,
                eventData.detection_tirps,
                eventData.prediction,
                eventData.TTE,
                safeEventPatterns,
                intervalsToFix,
                eventData.patterns_prob || {}, // Add patterns_prob parameter
                eventData.event_active, // Add event_active parameter
                eventData.event_occurred
              );
            }
          });
          this.lastKnownTimestamp = latestTimestamp; // Update lastKnownTimestamp with the latest server timestamp
          
          // Update centralized timing service
          if (latestTimestamp !== null) {
            TimingService.updateTimestamp(latestTimestamp);
          }
        } else {
          this.missedFetchCount++;
          console.log(`No new data received. Missed fetch count: ${this.missedFetchCount}`);
        }

        // Stop fetching if no new data is received for MAX_MISSED_FETCHES times
        if (this.missedFetchCount >= this.MAX_MISSED_FETCHES) {
          console.log(`No new data received for ${this.MAX_MISSED_FETCHES} consecutive fetches. Stopping updates.`);
          this.isFetching = false;
          this.disconnect();
          return;
        }

        // Mark fetch as complete before scheduling next one
        this.isFetching = false;
        
        // Schedule next fetch AFTER all processing is complete
        this.scheduleNextFetch();

      } catch (error) {
        console.error('Error fetching data:', error);
        // Mark fetch as complete even on error
        this.isFetching = false;
        // Even on error, schedule next fetch to keep trying
        this.scheduleNextFetch();
      }
    };

    // Helper method to schedule the next fetch based on current mode
    this.scheduleNextFetch = () => {
      // Bail out if session has changed or service is stopped
      if (thisConnectVersion !== this.sessionVersion) return;
      if (!this.isRunning) return;

      // Check if we need to switch from fast to normal interval
      if (this.fetchCount >= this.FAST_FETCH_COUNT) {
        // Clear any existing interval
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        
        // Notify UI that fast fetch phase is complete (only once)
        if (!this.fastFetchCompleteDispatched) {
          console.log(`Fast fetch phase complete (${this.FAST_FETCH_COUNT} fetches), switching to normal interval (${this.NORMAL_INTERVAL}ms)...`);
          window.dispatchEvent(new CustomEvent('fast_fetches_complete'));
          this.fastFetchCompleteDispatched = true;
        }
        
        // Stop fast fetch mode
        this.runFastFetches = false;
        
        // Schedule next fetch using normal interval (only if not already scheduled)
        if (!this.intervalId) {
          this.intervalId = setInterval(() => this.fetchData(), this.NORMAL_INTERVAL);
        }
      } else if (this.runFastFetches) {
        // Still in fast fetch mode - schedule next fetch with delay
        // This ensures: 1) previous fetch is complete, 2) UI has time to render, 3) network can handle the rate
        setTimeout(() => this.fetchData(), this.FAST_INTERVAL);
      }
    };

    // Start with controlled fast fetching using setTimeout instead of setInterval
    this.runFastFetches = true;

    // Start the first fetch
    this.fetchData();
  }

  disconnect() {
    // Advance the session version immediately so that any still-pending
    // fetches associated with the old entity will be recognised and their
    // responses discarded once they resolve.
    this.sessionVersion += 1;

    this.isRunning = false;
    this.isFetching = false; // Reset fetching flag
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped data updates.');
    }
    
    // Reset fetch-related counters and timing, but KEEP the data
    this.missedFetchCount = 0;
    this.fetchCount = 0;
    
    console.log('Data updates stopped - graphs will retain their current data');
  }

  // New method to clear all data - should only be called when selecting new model/entity
  clearAllData() {
    // Clear stored data related to the previous entity
    this.dataStore = {};
    this.timestampListeners = {}; // Clear timestamp listeners so graphs don't continue to tick
    this.eventActiveListeners = {}; // Clear event active listeners
    this.eventOccurredListeners = {};
    this.lastDetectionTirps = {};
    this.pendingDeletions = {}; // Clear pending deletions
    this.lastKnownTimestamp = null;
    this.isFetching = false; // Reset fetching flag
    
    // Reset centralized timing service
    TimingService.reset();
    
    console.log('Cleared all stored data in DataUpdateService');
  }

  // Update the data store for a specific event
  updateDataStore(eventId, entityData) {
    if (!this.dataStore[eventId]) {
      this.dataStore[eventId] = {};
    }

    // Get all existing temporal properties for this event to maintain consistency
    const existingProperties = Object.keys(this.dataStore[eventId]);
    
    // Get the current timestamp from the first property data (they should all have the same timestamp)
    const currentTimestamp = Object.values(entityData)[0]?.time;

    // Initialize new properties with transparent placeholders to match existing timeline
    Object.keys(entityData).forEach((temporalPropertyId) => {
      if (!this.dataStore[eventId][temporalPropertyId]) {
        this.dataStore[eventId][temporalPropertyId] = [];
        
        // If this is a new property and other properties already exist, 
        // we need to backfill with transparent placeholders
        if (existingProperties.length > 0) {
          // Get the timeline length from any existing property
          const existingPropertyData = this.dataStore[eventId][existingProperties[0]];
          const timelineLength = existingPropertyData.length;
          
          // Backfill with transparent placeholders
          for (let i = 0; i < timelineLength; i++) {
            const existingTimestamp = existingPropertyData[i].time;
            const transparentData = {
              time: existingTimestamp,
              state_id: 0,
              raw_value: 0,
              transparent: true
            };
            this.dataStore[eventId][temporalPropertyId].push(transparentData);
          }
        }
      }
    });

    Object.keys(entityData).forEach((temporalPropertyId) => {
      this.dataStore[eventId][temporalPropertyId].push(entityData[temporalPropertyId]);

      // Keep only last 120 entries
      if (this.dataStore[eventId][temporalPropertyId].length > 120) {
        this.dataStore[eventId][temporalPropertyId] = this.dataStore[eventId][temporalPropertyId].slice(-120);
      }
    
      // Apply any pending deletions for this property
      this.applyPendingDeletions(eventId, temporalPropertyId);
    });

    // Add transparent placeholder data points for existing properties that didn't receive data this timestamp
    if (currentTimestamp !== undefined) {
      existingProperties.forEach((propertyId) => {
        if (!entityData[propertyId]) {
          // This property didn't receive data this timestamp, add a transparent placeholder
          const transparentData = {
            time: currentTimestamp,
            state_id: 0, // Use default state
            raw_value: 0,
            transparent: true
          };
          
          if (!this.dataStore[eventId][propertyId]) {
            this.dataStore[eventId][propertyId] = [];
          }
          
          this.dataStore[eventId][propertyId].push(transparentData);
          
          // Keep only last 120 entries
          if (this.dataStore[eventId][propertyId].length > 120) {
            this.dataStore[eventId][propertyId] = this.dataStore[eventId][propertyId].slice(-120);
          }
          
          // Apply any pending deletions for this property
          this.applyPendingDeletions(eventId, propertyId);
        }
      });
    }
    
    // Ensure all properties have consistent timeline lengths
    this.synchronizePropertyTimelines(eventId);
  }

  // Synchronize all property timelines to ensure consistent lengths
  synchronizePropertyTimelines(eventId) {
    if (!this.dataStore[eventId]) return;
    
    const properties = Object.keys(this.dataStore[eventId]);
    if (properties.length <= 1) return;
    
    // Find the maximum length among all properties
    const maxLength = Math.max(...properties.map(prop => this.dataStore[eventId][prop].length));
    
    // Ensure all properties have the same length
    properties.forEach(propertyId => {
      const currentLength = this.dataStore[eventId][propertyId].length;
      if (currentLength < maxLength) {
        // Get the last timestamp from any property that has the max length
        const referenceProperty = properties.find(prop => this.dataStore[eventId][prop].length === maxLength);
        const referenceData = this.dataStore[eventId][referenceProperty];
        
        // Fill missing timestamps with transparent placeholders
        for (let i = currentLength; i < maxLength; i++) {
          const transparentData = {
            time: referenceData[i].time,
            state_id: 0,
            raw_value: 0,
            transparent: true
          };
          this.dataStore[eventId][propertyId].push(transparentData);
        }
      }
    });
  }

  // Apply pending deletions to newly arrived data
  applyPendingDeletions(eventId, temporalPropertyId) {
    const pendingKey = `${eventId}-${temporalPropertyId}`;
    if (this.pendingDeletions[pendingKey]) {
      //console.log(`[DataUpdateService] Applying ${this.pendingDeletions[pendingKey].length} pending deletions to property ${temporalPropertyId}`);
      
      this.pendingDeletions[pendingKey].forEach(([startTime, endTime]) => {
        this.dataStore[eventId][temporalPropertyId].forEach(point => {
          const intervalStart = point.time;
          const intervalEnd = point.time + 1;
          const intervalCenter = (intervalStart + intervalEnd) / 2;
          const isCompletelyContained = intervalStart >= startTime && intervalEnd <= endTime;
          const isCenterWithinRange = intervalCenter >= startTime && intervalCenter <= endTime;
          
          if (isCompletelyContained || isCenterWithinRange) {
            point.transparent = true;
            point.deleted = true;
          }
        });
      });
      
      // Clear pending deletions for this property
      delete this.pendingDeletions[pendingKey];
    }
  }

  // Remove intervals from data store based on intervals_to_fix
  removeIntervalsFromDataStore(eventId, intervalsToFix) {
    if (!intervalsToFix || Object.keys(intervalsToFix).length === 0) {
      return;
    }

    // Ensure the event exists in the data store
    if (!this.dataStore[eventId]) {
      this.dataStore[eventId] = {};
    }

    Object.entries(intervalsToFix).forEach(([temporalPropertyId, timeRange]) => {
      // Ensure the property exists in the data store, even if empty
      if (!this.dataStore[eventId][temporalPropertyId]) {
        this.dataStore[eventId][temporalPropertyId] = [];
      }

      if (this.dataStore[eventId][temporalPropertyId].length > 0) {
        const [startTime, endTime] = timeRange;
        // Mark intervals as transparent instead of removing them
        // Use more precise logic: only mark intervals that are substantially within the range
        this.dataStore[eventId][temporalPropertyId].forEach(point => {
          const intervalStart = point.time;
          const intervalEnd = point.time + 1; // Each interval is 1 second long
          
          // More conservative overlap detection: 
          // Only delete if the interval center is within the deletion range
          // OR if the interval is completely contained within the deletion range
          const intervalCenter = (intervalStart + intervalEnd) / 2;
          const isCompletelyContained = intervalStart >= startTime && intervalEnd <= endTime;
          const isCenterWithinRange = intervalCenter >= startTime && intervalCenter <= endTime;
          
          if (isCompletelyContained || isCenterWithinRange) {
            point.transparent = true;
            point.deleted = true; // Mark as deleted for tracking
          }
        });
        //console.log(`[DataUpdateService] Processed intervals for property ${temporalPropertyId} in time range [${startTime}, ${endTime}] - found ${this.dataStore[eventId][temporalPropertyId].length} stored intervals`);
      } else {
        // No data yet - add to pending deletions
        const pendingKey = `${eventId}-${temporalPropertyId}`;
        if (!this.pendingDeletions[pendingKey]) {
          this.pendingDeletions[pendingKey] = [];
        }
        this.pendingDeletions[pendingKey].push(timeRange);
        //console.log(`[DataUpdateService] No stored intervals found for property ${temporalPropertyId} - added deletion [${timeRange[0]}, ${timeRange[1]}] to pending list`);
      }
    });
  }

  getStoredData(temporalPropertyId, eventId) {
    return this.dataStore[eventId]?.[temporalPropertyId] || [];
  }

  // Add listener for a specific event and temporal property
  addListener(temporalPropertyId, callback, eventId) {
    const key = `${eventId}-${temporalPropertyId}`;
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);
  }

  // Remove listener for a specific event and temporal property
  removeListener(temporalPropertyId, callback, eventId) {
    const key = `${eventId}-${temporalPropertyId}`;
    if (this.listeners[key]) {
      this.listeners[key] = this.listeners[key].filter((cb) => cb !== callback);
    }
  }

  notifyListeners(eventId, entity_data, timestamp, detection_tirps, prediction, TTE, event_patterns, intervalsToFix, patterns_prob, event_active, event_occurred) {
    // Store detection_tirps for reference (moved to end after processing)
    
    // If no entity_data but we have existing properties, add transparent placeholders
    if ((!entity_data || Object.keys(entity_data).length === 0) && this.dataStore[eventId]) {
      const existingProperties = Object.keys(this.dataStore[eventId]);
      if (existingProperties.length > 0 && timestamp !== undefined) {
        //console.log(`[DataUpdateService] Adding transparent placeholders for ${existingProperties.length} properties at timestamp ${timestamp}`);
        
        // Create transparent placeholder data for all existing properties
        existingProperties.forEach((propertyId) => {
          const transparentData = {
            time: timestamp,
            state_id: 0, // Use default state
            raw_value: 0,
            transparent: true
          };
          
          if (!this.dataStore[eventId][propertyId]) {
            this.dataStore[eventId][propertyId] = [];
          }
          
          this.dataStore[eventId][propertyId].push(transparentData);
          
          // Keep only last 120 entries
          if (this.dataStore[eventId][propertyId].length > 120) {
            this.dataStore[eventId][propertyId] = this.dataStore[eventId][propertyId].slice(-120);
          }
          
          // Apply any pending deletions for this property
          this.applyPendingDeletions(eventId, propertyId);
        });
        
        // Ensure all properties have consistent timeline lengths
        this.synchronizePropertyTimelines(eventId);
      }
    }
    
    // Notify timestamp listeners first - these get called for every timestamp
    const timestampKey = eventId.toString();
    if (this.timestampListeners[timestampKey]) {
      this.timestampListeners[timestampKey].forEach(callback => 
        callback(timestamp, entity_data, intervalsToFix)
      );
    }
    
    // Notify special listeners with the complete data
    const eventData = {
      [eventId]: {
        entity_data,
        timestamp,
        detection_tirps,
        prediction,
        TTE,
        event_patterns,
        intervals_to_fix: intervalsToFix,
        patterns_prob: patterns_prob || {} // Add patterns_prob to event data
      }
    };
    
    // Special listeners for pattern detection
    Object.keys(this.specialListeners).forEach(key => {
      if (this.specialListeners[key] && this.specialListeners[key].length > 0) {
        this.specialListeners[key].forEach(callback => callback(eventData));
      }
    });
    
    // Notify regular temporal property listeners
    Object.keys(entity_data).forEach((temporalPropertyId) => {
      const listenerKey = `${eventId}-${temporalPropertyId}`;
      if (this.listeners[listenerKey] && this.listeners[listenerKey].length > 0) {
        const filteredData = entity_data[temporalPropertyId];
        // Check if this temporal property has intervals to fix
        const propertyIntervalsToFix = intervalsToFix[temporalPropertyId] || null;
        this.listeners[listenerKey].forEach((callback) => callback(filteredData, propertyIntervalsToFix));
      }
    });

    // Notify pattern listeners (with event_patterns)
    Object.keys(this.patternListeners).forEach((patternKey) => {
      const [eventIdStr, stateIdsStr] = patternKey.split('--');
      // Only process if this is the correct event
      if (eventIdStr === eventId.toString()) {
        const stateIds = JSON.parse(stateIdsStr);
        const filteredData = {};

        Object.values(entity_data).forEach((propData) => {
          if (stateIds.includes(parseInt(propData.state_id))) {
            filteredData[propData.state_id] = propData;
          }
        });

        // Debug: Log the pattern listener being called
        //console.log(`[notifyListeners] Calling pattern listener for key ${patternKey} with event_patterns:`, event_patterns);
        
        this.patternListeners[patternKey].forEach((callback) =>
          callback(filteredData, timestamp, event_patterns, intervalsToFix)
        );
      }
    });

    // Enhanced TIRP notification with pattern disappearance handling
    const currentDetectionTirps = detection_tirps || {};
    const previousDetectionTirps = this.lastDetectionTirps[eventId] || {};
    
    // Track all pattern indices that have TIRP listeners for this event
    const eventTirpListeners = {};
    Object.keys(this.tirpListeners).forEach(key => {
      if (key.startsWith(`${eventId}-`)) {
        const patternIndex = key.substring(`${eventId}-`.length);
        eventTirpListeners[patternIndex] = this.tirpListeners[key];
      }
    });
    
    // Notify listeners for patterns that currently have TIRPs
    Object.entries(currentDetectionTirps).forEach(([patternIndex, tirps]) => {
      const key = `${eventId}-${patternIndex}`;
      if (this.tirpListeners[key]) {
        this.tirpListeners[key].forEach((callback) => callback(tirps));
      }
    });
    
    // Notify listeners for patterns that HAD TIRPs but don't anymore (send empty array)
    Object.keys(previousDetectionTirps).forEach(patternIndex => {
      // If pattern existed before but doesn't exist now, clear it
      if (!currentDetectionTirps[patternIndex]) {
        const key = `${eventId}-${patternIndex}`;
        if (this.tirpListeners[key]) {
         // console.log(`[DataUpdateService] Pattern ${patternIndex} disappeared from detection_tirps, clearing TIRPs`);
          this.tirpListeners[key].forEach((callback) => callback([]));
        }
      }
    });
    
    // Update the stored detection_tirps for this event
    this.lastDetectionTirps[eventId] = { ...currentDetectionTirps };

    // Notify pattern probability listeners independently using patterns_prob
    if (patterns_prob && Object.keys(patterns_prob).length > 0) {
      // Get all registered pattern probability listeners for this event
      const eventPattern = `${eventId}-`;
      Object.keys(this.patternProbabilityListeners).forEach(key => {
        if (key.startsWith(eventPattern)) {
          const patternIndex = key.substring(eventPattern.length);
          // Use the probability from patterns_prob if available, otherwise 0
          const probability = patterns_prob[patternIndex] !== undefined ? patterns_prob[patternIndex] : 0;
          this.patternProbabilityListeners[key].forEach(cb => cb(probability));
        }
      });
    } else {
      // If no patterns_prob data, set all pattern probabilities to 0
      const eventPattern = `${eventId}-`;
      Object.keys(this.patternProbabilityListeners).forEach(key => {
        if (key.startsWith(eventPattern)) {
          this.patternProbabilityListeners[key].forEach(cb => cb(0));
        }
      });
    }

    // Notify probability listeners for this event
    const normalizedPrediction = normalizeProbability(prediction);
    if (normalizedPrediction !== null) {
      const key = eventId.toString();
      if (this.probabilityListeners[key]) {
        this.probabilityListeners[key].forEach((callback) => callback(normalizedPrediction));
      }
    }

    // Notify TTE listeners for this event
    if (typeof TTE === 'object' || typeof TTE === 'number') {
      const key = eventId.toString();
      if (TTE === null) { TTE=0}
      if (this.tteListeners[key]) {
        this.tteListeners[key].forEach((callback) => callback(TTE));
      }
    }

    // Notify event active listeners
    if (event_active !== undefined) {
      const key = eventId.toString();
      if (this.eventActiveListeners[key]) {
        this.eventActiveListeners[key].forEach((callback) => callback(event_active));
      }
    }

    // Notify event occurred listeners
    if (event_occurred !== undefined) {
      const key = eventId.toString();
      if (this.eventOccurredListeners[key]) {
        this.eventOccurredListeners[key].forEach((callback) => callback(event_occurred, timestamp));
      }
    }
  }

  addPatternListener(eventId, patternKey, callback) {
    const key = `${eventId}--${JSON.stringify(patternKey)}`;
    if (!this.patternListeners[key]) {
      this.patternListeners[key] = [];
    }
    this.patternListeners[key].push(callback);
  }

  removePatternListener(eventId, patternKey, callback) {
    const key = `${eventId}--${JSON.stringify(patternKey)}`;
    if (this.patternListeners[key]) {
      this.patternListeners[key] = this.patternListeners[key].filter((cb) => cb !== callback);
    }
  }

  addPatternProbabilityListener(key, cb) {
  if (!this.patternProbabilityListeners[key]) {
    this.patternProbabilityListeners[key] = [];
    }
    this.patternProbabilityListeners[key].push(cb);
  }

  removePatternProbabilityListener(key, cb) {
    const arr = this.patternProbabilityListeners[key];
    if (arr) {
      this.patternProbabilityListeners[key] =
        arr.filter(f => f !== cb);
    }
  }

  addTirpListener(key, callback) {
    if (!this.tirpListeners[key]) {
      this.tirpListeners[key] = [];
    }
    this.tirpListeners[key].push(callback);
  }

  removeTirpListener(key, callback) {
    if (this.tirpListeners[key]) {
      this.tirpListeners[key] = this.tirpListeners[key].filter((cb) => cb !== callback);
    }
  }

  addProbabilityListener(eventId, callback) {
    const key = eventId.toString();
    if (!this.probabilityListeners[key]) {
      this.probabilityListeners[key] = [];
    }
    this.probabilityListeners[key].push(callback);
  }

  removeProbabilityListener(eventId, callback) {
    const key = eventId.toString();
    if (this.probabilityListeners[key]) {
      this.probabilityListeners[key] = this.probabilityListeners[key].filter((cb) => cb !== callback);
    }
  }

  addTTEListener(eventId, callback) {
    const key = eventId.toString();
    if (!this.tteListeners[key]) {
      this.tteListeners[key] = [];
    }
    this.tteListeners[key].push(callback);
  }

  removeTTEListener(eventId, callback) {
    const key = eventId.toString();
    if (this.tteListeners[key]) {
      this.tteListeners[key] = this.tteListeners[key].filter((cb) => cb !== callback);
    }
  }

  // Add a special listener function
  addSpecialListener(key, callback) {
    if (!this.specialListeners[key]) {
      this.specialListeners[key] = [];
    }
    this.specialListeners[key].push(callback);
  }
  
  // Remove a special listener function
  removeSpecialListener(key, callback) {
    if (this.specialListeners[key]) {
      this.specialListeners[key] = this.specialListeners[key].filter(cb => cb !== callback);
    }
  }

  // Add event active listener
  addEventActiveListener(eventId, callback) {
    const key = eventId.toString();
    if (!this.eventActiveListeners[key]) {
      this.eventActiveListeners[key] = [];
    }
    this.eventActiveListeners[key].push(callback);
  }

  // Remove event active listener
  removeEventActiveListener(eventId, callback) {
    const key = eventId.toString();
    if (this.eventActiveListeners[key]) {
      this.eventActiveListeners[key] = this.eventActiveListeners[key].filter(cb => cb !== callback);
    }
  }

  addEventOccurredListener(eventId, callback) {
    const key = eventId.toString();
    if (!this.eventOccurredListeners[key]) {
      this.eventOccurredListeners[key] = [];
    }
    this.eventOccurredListeners[key].push(callback);
  }

  removeEventOccurredListener(eventId, callback) {
    const key = eventId.toString();
    if (this.eventOccurredListeners[key]) {
      this.eventOccurredListeners[key] = this.eventOccurredListeners[key].filter(cb => cb !== callback);
    }
  }
  
  // Get the latest detection_tirps for a specific event
  getDetectionTirps(eventId) {
    return this.lastDetectionTirps[eventId] || {};
  }

  // Add timestamp listener for continuous graph progression
  addTimestampListener(eventId, callback) {
    const key = eventId.toString();
    if (!this.timestampListeners[key]) {
      this.timestampListeners[key] = [];
    }
    this.timestampListeners[key].push(callback);
  }

  // Remove timestamp listener
  removeTimestampListener(eventId, callback) {
    const key = eventId.toString();
    if (this.timestampListeners[key]) {
      this.timestampListeners[key] = this.timestampListeners[key].filter(cb => cb !== callback);
    }
  }

  // Enable user study mode with optional max fetch limit
  enableUserStudyMode(maxFetchLimit = null) {
    this.userStudyMode = true;
    if (maxFetchLimit !== null && maxFetchLimit > 0) {
      this.MAX_FETCH_LIMIT = maxFetchLimit;
    }
    console.log(`User study mode enabled. Max fetch limit: ${this.MAX_FETCH_LIMIT}`);
  }

  // Disable user study mode
  disableUserStudyMode() {
    this.userStudyMode = false;
    console.log('User study mode disabled.');
  }

  // Check if user study mode is active
  isUserStudyMode() {
    return this.userStudyMode;
  }

  // Get current fetch count
  getCurrentFetchCount() {
    return this.fetchCount;
  }

  // Get max fetch limit
  getMaxFetchLimit() {
    return this.MAX_FETCH_LIMIT;
  }
}

export default new DataUpdateService();