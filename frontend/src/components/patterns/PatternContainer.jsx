import React, { useState, useEffect,useRef } from 'react';
import PatternIntervals from './PatternIntervals';
import DataUpdateService from '../dataService/DataUpdateService';
import { usePatternContext } from './PatternContext';
import { useEventContext } from '../events/EventContext';
import DataManagementService from '../dataService/DataManagementService';

export default function PatternContainer(props) {
  const [eventPatternMap, setEventPatternMap] = useState({});
  const [allPatternsLoaded, setAllPatternsLoaded] = useState(false);
  const { selectedPatternIndex } = usePatternContext();
  const { selectedEvent, eventPatterns, showAllPatterns, MAIN_TAB_ID, patternsLoaded } = useEventContext();
  const [patternProbabilities, setPatternProbabilities] = useState({});
  const patternListenersRef = useRef([]);
  const [sortBy, setSortBy] = useState('importance');   // 'probability' | 'importance'

  const hideSort = selectedEvent === MAIN_TAB_ID || selectedEvent === null || selectedPatternIndex !== null;

  // Load all patterns for all events
  useEffect(() => {
    const fetchAllPatterns = async () => {
      if (!patternsLoaded) return;

      try {
        //console.log("[PatternContainer] Loading patterns for all events");
        //console.log('Im inaide fetchAllPatterns, eventPatterns',eventPatterns);
        // Get all events that have patterns
        const eventIds = Object.keys(eventPatterns)
          .filter(id => id !== MAIN_TAB_ID && Object.keys(eventPatterns[id] || {}).length > 0);
        
        // Fetch patterns for each event
        const patternsPromises = eventIds.map(async (eventId) => {
          try {
            const patternsArray = await DataManagementService.fetchPatternsWithImportance(parseInt(eventId));
            return { eventId, patternsArray };
          } catch (error) {
            console.error(`Error fetching patterns for event ${eventId}:`, error);
            return { eventId, patternsArray: [] };
          }
        });

        // Wait for all patterns to be fetched
        const patternsResults = await Promise.all(patternsPromises);
        
        // Build the complete pattern map
        const newPatternMap = patternsResults.reduce((acc, { eventId, patternsArray }) => {
          acc[eventId] = patternsArray;
          return acc;
        }, {});

        setEventPatternMap(newPatternMap);
        setAllPatternsLoaded(true);
//        console.log("[PatternContainer] All patterns loaded:", newPatternMap);
      } catch (error) {
        console.error('Error fetching all patterns:', error);
        setAllPatternsLoaded(true); // Mark as loaded even on error
      }
    };

    fetchAllPatterns();

    // Set up listener for entity/model changes
    const handleEntityModelChange = () => {
      setEventPatternMap({}); // Clear all event patterns
      setAllPatternsLoaded(false);
    };

    // Listen for entity/model changes
    window.addEventListener('entity_model_changed', handleEntityModelChange);

    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, [eventPatterns, patternsLoaded, MAIN_TAB_ID]);

  useEffect(() => {
    patternListenersRef.current.forEach(({key, cb}) =>
      DataUpdateService.removePatternProbabilityListener(key, cb)
    );
    patternListenersRef.current = [];

    Object.entries(eventPatternMap).forEach(([eventId, patterns]) => {
      patterns.forEach(({ index }) => {
        const key = `${eventId}-${index}`;
        const cb = (prob) =>
          setPatternProbabilities(prev => {
            const p = { ...prev };
            if (!p[eventId]) p[eventId] = {};
            p[eventId][index] = prob;
            return p;
          });

        DataUpdateService.addPatternProbabilityListener(key, cb);
        patternListenersRef.current.push({ key, cb });
      });
    });

  return () => {
    patternListenersRef.current.forEach(({key, cb}) =>
      DataUpdateService.removePatternProbabilityListener(key, cb)
    );
    patternListenersRef.current = [];
  };
}, [eventPatternMap]);

  // If patterns are not loaded yet, don't render anything
  if (!allPatternsLoaded || !patternsLoaded) {
    return null;
  }

  // Get all patterns for all events
  const getAllPatterns = () => {
    const allPatterns = [];
    
    //console.log('Im inaide getAllPatterns, eventPatternMap',eventPatternMap);
    Object.entries(eventPatternMap).forEach(([eventId, patterns]) => {
      //console.log('Im inaide getAllPatterns, eventId and patterns',eventId, patterns);
      if (patterns && patterns.length > 0) {
        patterns.forEach(pattern => {
          allPatterns.push({
            ...pattern,
            eventId: parseInt(eventId)
          });
        });
      }
    });
    
    return allPatterns;
  };


  // Determine which patterns should be visible based on selected event and pattern
  const getVisiblePatterns = (patternList) => {
    const visiblePatterns = {};
    
    // Create entries for all patterns first (all hidden by default)
    patternList.forEach(pattern => {
      const key = `${pattern.eventId}-${pattern.index}`;
      visiblePatterns[key] = false;
    });
    
    // If we're on the main tab or no event is selected, keep all hidden
    if (selectedEvent === MAIN_TAB_ID || selectedEvent === null) {
      return visiblePatterns;
    }
    
    // Make patterns for the selected event visible
    patternList.forEach(pattern => {
      if (pattern.eventId === selectedEvent) {
        const key = `${pattern.eventId}-${pattern.index}`;
        
        // If a specific pattern is selected, only show that one
        if (selectedPatternIndex !== null && !showAllPatterns) {
          visiblePatterns[key] = pattern.index === selectedPatternIndex;
        } else {
          // Otherwise show all patterns for this event
          visiblePatterns[key] = true;
        }
      }
    });
    
    return visiblePatterns;
  };

  const allPatterns = getAllPatterns();

  // --------- sort helpers -------------
  const sortByProb = (a, b) => {
    if (a.eventId !== b.eventId) return 0;
    const pa = patternProbabilities[a.eventId]?.[a.index] ?? 0;
    const pb = patternProbabilities[b.eventId]?.[b.index] ?? 0;
    return pb - pa;
  };

  const sortByImportance = (a, b) => {
    if (a.eventId !== b.eventId) return 0;
    const ia = a.importance ?? 0;
    const ib = b.importance ?? 0;
    return ib - ia;
  };

  const sortedPatterns = [...allPatterns].sort(
    sortBy === 'probability' ? sortByProb : sortByImportance
  );


  const visiblePatterns = getVisiblePatterns(allPatterns);

  return (
    <div 
      className="pattern-container-overlay"
      style={{
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 140px)', // Adjust based on your header height
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* Sorting dropdown */}
      {!hideSort && (
      <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '0px 0px 8px 4px' }}>
        <label style={{ marginInlineEnd: '8px' }}>sort by</label>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="probability">Patterns Probability</option>
          <option value="importance">Patterns Importance</option>
        </select>
      </div>
      )}

      {sortedPatterns.map((pattern) => {
        const key = `${pattern.eventId}-${pattern.index}`;
        const isVisible = visiblePatterns[key];
        
        return (
          <div
            key={key}
            style={{
              visibility: isVisible ? 'visible' : 'hidden',
              height: isVisible ? 'auto' : '0',
              overflow: isVisible ? 'visible' : 'hidden',
              padding: isVisible ? '16px 16px' : '0',
              backgroundColor: '#F7F7F7',
              borderBottom: isVisible ? '6px solid rgb(255, 255, 255)' : 'none',
              marginBottom: isVisible ? '4px' : '0',
              marginLeft: '0px',
              marginRight: '4px',
              marginTop: '0px',
              border: isVisible ? '2px solid #E0E0E0' : 'none',
              borderRadius: '4px',
              transition: 'all 0.3s ease',
              position: 'relative',
              opacity: isVisible ? 1 : 0,
            }}

          >
            <PatternIntervals
              patternIndex={pattern.index}
              eventIndex={pattern.eventId}
              graphId={`pattern-graph-${pattern.index}-${pattern.eventId}`}
              webSocketService={DataUpdateService}
            />
          </div>
        );
      })}
    </div>
  );
}


