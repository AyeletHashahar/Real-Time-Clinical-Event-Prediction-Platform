import { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const VisibleGraphsContext = createContext();

// Create a custom hook to use the VisibleGraphsContext
export const useVisibleGraphs = () => {
  return useContext(VisibleGraphsContext);
};

// Provider component to wrap the app
export const VisibleGraphsProvider = ({ children }) => {
  // Store graph visibility keyed by event and property ID
  const [visibleGraphsByEvent, setVisibleGraphsByEvent] = useState({});

  // Store highlighted intervals keyed by eventId and propertyId
  // Structure: { [eventId]: { [propertyId]: [ {stateId, start, end}, ... ] } }
  const [highlightedIntervalsByEvent, setHighlightedIntervalsByEvent] = useState({});

  // Store the order in which graphs are made visible for each event
  // Structure: { [eventId]: [propertyId1, propertyId2, ...] }
  const [visibleGraphOrderByEvent, setVisibleGraphOrderByEvent] = useState({});

  // Listen for entity/model changes to reset visible graphs and highlights
  useEffect(() => {
    const handleEntityModelChange = () => {
      setVisibleGraphsByEvent({}); // Clear all visible graphs
      setHighlightedIntervalsByEvent({}); // Clear all highlights
      setVisibleGraphOrderByEvent({}); // Clear graph order
    };

    window.addEventListener('entity_model_changed', handleEntityModelChange);
    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, []);

  // Function to toggle graph visibility for a specific event
  const toggleGraphVisibility = (graphId, eventId = 0) => {
    // Create a composite key using eventId and graphId
    const key = `${eventId}-${graphId}`;
    
    setVisibleGraphsByEvent((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Get all visible graphs for a specific event
  const getVisibleGraphsForEvent = (eventId = 0) => {
    const result = {};
    Object.entries(visibleGraphsByEvent).forEach(([key, isVisible]) => {
      if (isVisible && key.startsWith(`${eventId}-`)) {
        const graphId = parseInt(key.split('-')[1], 10);
        result[graphId] = true;
      }
    });
    return result;
  };

  // Get visible graphs for an event in the order they were made visible
  const getVisibleGraphsInOrder = (eventId = 0) => {
    const visibleOrder = visibleGraphOrderByEvent[eventId] || [];
    const visibleGraphs = getVisibleGraphsForEvent(eventId);
    
    // Return only the graphs that are both in the order list and currently visible
    return visibleOrder.filter(propertyId => visibleGraphs[propertyId]);
  };

  // Updated function to show only specific graphs for a specific event
  const showOnlyGraphs = (graphIds, eventId = 0) => {
    setVisibleGraphsByEvent((prev) => {
      const newVisibleGraphs = { ...prev };
      
      // First, hide all graphs for this event
      Object.keys(prev).forEach(key => {
        if (key.startsWith(`${eventId}-`)) {
          newVisibleGraphs[key] = false;
        }
      });
      
      // Then show only the specified graphs
      graphIds.forEach(id => {
        newVisibleGraphs[`${eventId}-${id}`] = true;
      });
      
      return newVisibleGraphs;
    });

    // Update the visible graph order for this event
    setVisibleGraphOrderByEvent(prev => ({
      ...prev,
      [eventId]: [...graphIds] // Store the order in which graphs are made visible
    }));
  };

  // Check if a graph is visible for a specific event
  const isGraphVisible = (graphId, eventId = 0) => {
    const key = `${eventId}-${graphId}`;
    return !!visibleGraphsByEvent[key];
  };

  // Set highlighted intervals for a specific event and property
  const setHighlightedIntervals = (eventId, propertyId, intervals) => {
    setHighlightedIntervalsByEvent(prev => {
      const newEvent = { ...(prev[eventId] || {}), [propertyId]: intervals };
      return { ...prev, [eventId]: newEvent };
    });
  };

  // Get highlighted intervals for a specific event and property
  const getHighlightedIntervals = (eventId, propertyId) => {
    return highlightedIntervalsByEvent[eventId]?.[propertyId] || [];
  };

  // For backward compatibility, provide a simple visibleGraphs object for the current event
  // This will be used by components that don't specify an eventId
  return (
    <VisibleGraphsContext.Provider 
      value={{ 
        visibleGraphs: getVisibleGraphsForEvent(0), // For backward compatibility
        visibleGraphsByEvent,
        toggleGraphVisibility, 
        showOnlyGraphs, 
        isGraphVisible,
        getVisibleGraphsForEvent,
        getVisibleGraphsInOrder, // New function to get graphs in order
        // New for highlights:
        setHighlightedIntervals,
        getHighlightedIntervals,
      }}>
      {children}
    </VisibleGraphsContext.Provider>
  );
};
