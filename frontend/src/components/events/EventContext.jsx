import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';
import { useVisibleGraphs } from '../graphs/GraphContext';
import DataManagementService from '../dataService/DataManagementService';
import DataUpdateService from '../dataService/DataUpdateService';

const EventContext = createContext();

// Special ID for the Main tab
export const MAIN_TAB_ID = 'main';

export const useEventContext = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within an EventProvider');
  }
  return context;
};

export const EventProvider = ({ children }) => {
  const [selectedEvent, setSelectedEvent] = useState(MAIN_TAB_ID);
  const [eventPatterns, setEventPatterns] = useState({});
  const [events, setEvents] = useState([]);
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [patternsLoaded, setPatternsLoaded] = useState(false);
  const visibleGraphsContext = useVisibleGraphs();

  // Load all event patterns for all events
  const loadAllEventPatterns = useCallback(async (eventsArray) => {
    try {
      //console.log("[EventContext] Loading patterns for all events");
      const patternsPromises = eventsArray.map(async (event) => {
        try {
          const { raw: patterns } = await DataManagementService.fetchEventPatterns(event.id);
          //console.log('Im inaide loadAllEventPatterns, event.id and patterns',event.id, patterns);
          return { eventId: event.id, patterns };
        } catch (error) {
          console.error(`Error loading patterns for event ${event.id}:`, error);
          return { eventId: event.id, patterns: {} };
        }
      });

      const patternsResults = await Promise.all(patternsPromises);
      
      // Create a new object with all event patterns
      const allPatterns = patternsResults.reduce((acc, { eventId, patterns }) => {
        acc[eventId] = patterns;
        return acc;
      }, {});

      // Add main tab patterns as empty object
      allPatterns[MAIN_TAB_ID] = {};

      // Update state with all patterns at once
      setEventPatterns(allPatterns);
      setPatternsLoaded(true);
      
    //  console.log("[EventContext] All patterns loaded:", allPatterns);
    } catch (error) {
      console.error('Error loading all event patterns:', error);
      setPatternsLoaded(true); // Still mark as loaded even on error
    }
  }, []);

  // Load events on component mount and when entity/model changes
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsData = await DataManagementService.fetchAllEvents();
        const processedEvents = updateEvents(eventsData);
        
        // After events are loaded, load patterns for all events
        if (processedEvents && processedEvents.length > 0) {
          await loadAllEventPatterns(processedEvents);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setPatternsLoaded(true); // Mark as loaded even on error
      }
    };

    // Initial fetch
    fetchEvents();

    // Set up listener for entity/model changes
    const handleEntityModelChange = () => {
      setSelectedEvent(MAIN_TAB_ID);
      setEventPatterns({});
      setPatternsLoaded(false);
      fetchEvents();
    };

    // Listen for entity/model changes
    window.addEventListener('entity_model_changed', handleEntityModelChange);

    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, [loadAllEventPatterns]);

  const clearGraphs = useCallback(() => {
    if (visibleGraphsContext?.showOnlyGraphs) {
      visibleGraphsContext.showOnlyGraphs([]);
    }
  }, [visibleGraphsContext]);

  const updateEvents = useCallback((eventsData) => {
    if (!eventsData) {
      setEvents([]);
      return [];
    }

    let processedEvents = [];
    if (typeof eventsData === 'object' && !Array.isArray(eventsData)) {
      processedEvents = Object.entries(eventsData).map(([id, event]) => ({
        ...event,
        id: parseInt(id)
      }));
      setEvents(processedEvents);
    } else if (Array.isArray(eventsData)) {
      processedEvents = eventsData;
      setEvents(eventsData);
    } else {
      setEvents([]);
    }
    return processedEvents;
  }, []);

  // Keep the loadEventPatterns for backward compatibility but make it check if patterns are already loaded
  const loadEventPatterns = useCallback(async (eventId) => {
    if (eventId === MAIN_TAB_ID) {
      clearGraphs();
      return;
    }

    if (eventId === null) return;
    
    // Check if patterns for this event are already loaded
    if (eventPatterns[eventId]) {
      //console.log(`[EventContext] Patterns for event ${eventId} already loaded`);
      clearGraphs();
      setShowAllPatterns(true);
      return;
    }
    
    try {
      const { raw: patterns } = await DataManagementService.fetchEventPatterns(eventId);
      setEventPatterns(prev => ({
        ...prev,
        [eventId]: patterns
      }));
      
      clearGraphs();
      setShowAllPatterns(true);
    } catch (error) {
      console.error('Error loading event patterns:', error);
      setEventPatterns(prev => ({
        ...prev,
        [eventId]: {}
      }));
    }
  }, [clearGraphs, eventPatterns]);

  const value = useMemo(() => ({
    selectedEvent,
    setSelectedEvent,
    eventPatterns,
    setEventPatterns,
    events,
    setEvents: updateEvents,
    loadEventPatterns,
    showAllPatterns,
    setShowAllPatterns,
    clearGraphs,
    MAIN_TAB_ID,
    patternsLoaded
  }), [
    selectedEvent,
    eventPatterns,
    events,
    updateEvents,
    loadEventPatterns,
    showAllPatterns,
    clearGraphs,
    patternsLoaded
  ]);

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};

export default EventProvider;