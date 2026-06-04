import React, { useState, useEffect, useRef } from 'react';
import MainEventGraph from './mainGraph/MainEventGraph';
import DataUpdateService from '../dataService/DataUpdateService';
import { useEventContext } from './EventContext';
import { usePatternContext } from '../patterns/PatternContext';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DataManagementService from '../dataService/DataManagementService';
import { formatProbability, normalizeProbability, toServerFlag } from '../../utils/probabilityUtils';

export default function EventContainer() {
  const [allEvents, setAllEvents] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [eventProbabilities, setEventProbabilities] = useState({});
  const [eventTTEs, setEventTTEs] = useState({});
  const [eventActiveStates, setEventActiveStates] = useState({}); // Add state for tracking event active status
  const [eventOccurredStates, setEventOccurredStates] = useState({});
  const { selectedEvent, MAIN_TAB_ID } = useEventContext();
  const { selectedPatternIndex } = usePatternContext();
  // Add a key to force recreation of graphs when model/entity changes
  const [graphKey, setGraphKey] = useState(Date.now());
  // Track if initial expansion has been set
  const initialExpansionSetRef = useRef(false);
  // Track active probability listeners
  const activeListenersRef = useRef([]);

  // Load all events once at the start and when entity/model changes
  useEffect(() => {
    const fetchAllEvents = async () => {
      try {
        // Use DataManagementService to fetch events
        const eventsArray = await DataManagementService.fetchAllEvents();
       // console.log('Im inaide fetchAllEvents, eventsArray',eventsArray);
        setAllEvents(eventsArray);
        
        // Initialize all events as expanded by default, but only if not already set
        if (!initialExpansionSetRef.current) {
          const initialExpandState = {};
          eventsArray.forEach(event => {
            initialExpandState[event.id] = true;
          });
          setExpandedEvents(initialExpandState);
          initialExpansionSetRef.current = true;
        }
        
        // Set up probability listeners for all events
        setupProbabilityListeners(eventsArray);
      } catch (error) {
        console.error('Error fetching all events:', error);
        setAllEvents([]);
        if (!initialExpansionSetRef.current) {
          setExpandedEvents({});
          initialExpansionSetRef.current = true;
        }
      }
    };

    fetchAllEvents();

    // Listen for entity/model changes
    const handleEntityModelChange = () => {
      console.log("EventContainer: Entity or model changed, refreshing events");
      
      // Clear all stored data when entity/model changes
      DataUpdateService.clearAllData();
      
      // Reset event probabilities
      setEventProbabilities({});
      setEventTTEs({});
      setEventActiveStates({}); // Reset event active states
      setEventOccurredStates({});
      
      // Reset expanded states so that all event graphs start expanded
      setExpandedEvents({});           // clear previous expand/collapse flags
      initialExpansionSetRef.current = false; // allow fetchAllEvents to re-initialize expansions
       
      // Generate a new key to force recreation of all graphs
      setGraphKey(Date.now());
      
      // Fetch new events after a short delay to ensure backend is ready
      setTimeout(() => {
        fetchAllEvents();
        // Reconnect DataUpdateService after fetching new events
        DataUpdateService.connect();
      }, 500);
    };

    window.addEventListener('entity_model_changed', handleEntityModelChange);

    // Clean up all listeners on unmount
    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
      cleanupProbabilityListeners();
    };
  }, []);


  // Setup probability listeners for each event
  const setupProbabilityListeners = (events) => {
    // Cleanup existing listeners first
    cleanupProbabilityListeners();
    
    // Array to track new listeners
    const newListeners = [];
    
    events.forEach(event => {
      // Create event-specific handler
      const handleProbabilityUpdate = (prediction) => {
        const normalized = normalizeProbability(prediction);
        if (normalized == null) return;

        setEventProbabilities(prev => ({
          ...prev,
          [event.id]: normalized
        }));
      };
      
      // Add event-specific probability listener
      DataUpdateService.addProbabilityListener(event.id, handleProbabilityUpdate);
      
      // Save reference to the listener for cleanup
      newListeners.push({ eventId: event.id, callback: handleProbabilityUpdate });

      // TTE
      const handleTTEUpdate = tte => {
        setEventTTEs(prev => ({ ...prev, [event.id]: tte }));
      };
      
      DataUpdateService.addTTEListener(event.id, handleTTEUpdate);
      newListeners.push({ eventId: event.id, callback: handleTTEUpdate, type: 'tte' });

      // Event Active State
      const handleEventActiveStateUpdate = (isActive) => {
        setEventActiveStates(prev => ({ ...prev, [event.id]: toServerFlag(isActive) }));
      };
      DataUpdateService.addEventActiveListener(event.id, handleEventActiveStateUpdate);
      newListeners.push({ eventId: event.id, callback: handleEventActiveStateUpdate, type: 'active' });

      const handleEventOccurredUpdate = (occurred) => {
        setEventOccurredStates(prev => ({ ...prev, [event.id]: toServerFlag(occurred) }));
      };
      DataUpdateService.addEventOccurredListener(event.id, handleEventOccurredUpdate);
      newListeners.push({ eventId: event.id, callback: handleEventOccurredUpdate, type: 'occurred' });
    });
    
    // Store active listeners
    activeListenersRef.current = newListeners;
  };
  
  // Cleanup all probability listeners
  const cleanupProbabilityListeners = () => {
    activeListenersRef.current.forEach(({ eventId, callback, type }) => {
      if (type === 'tte') {
        DataUpdateService.removeTTEListener(eventId, callback);
      } else if (type === 'active') {
        DataUpdateService.removeEventActiveListener(eventId, callback);
      } else if (type === 'occurred') {
        DataUpdateService.removeEventOccurredListener(eventId, callback);
      } else {
        DataUpdateService.removeProbabilityListener(eventId, callback);
      }
    });
    activeListenersRef.current = [];
  };

  // If no events loaded yet, don't render anything
  if (!allEvents.length) {
    return null;
  }

  // Determine visibility for each event graph
  const isMainTab = selectedEvent === MAIN_TAB_ID;
  const showAllPatterns = selectedPatternIndex === null;

  // Determine container style based on current tab state
  const getContainerStyle = () => {
    // Rule 2: Pattern tab - container should be invisible
    if (!isMainTab && !showAllPatterns) {
      return {
        height: '0px',
        overflow: 'hidden',
        padding: '0px',
        margin: '0px',
      };
    }
    
    // Rule 1: Single event "All Patterns" tab - exact size of graph
    if (!isMainTab && showAllPatterns) {
      return {
        backgroundColor: 'rgb(255, 255, 255)',
        overflow: 'visible',
        height: 'auto',
        padding: '0px',
        margin: '0px',
      };
    }
    
    // Main tab - scrollable container (default behavior)
    return {
      backgroundColor: 'rgb(255, 255, 255)',
      overflow: 'auto',
      height: 'calc(100vh - 0px)',
      maxHeight: '100vh',
      marginBottom: '0px',
      padding: '0px',
      scrollBehavior: 'smooth',
    };
  };

  // Toggle expanded state for an event
  const toggleExpand = (eventId) => {
    setExpandedEvents(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };
  
  // Function to determine color based on probability
  const getProbabilityColor = (probability) => {
    if (probability >= 0.75) return 'rgb(202, 18, 18)';
    if (probability >= 0.55) return 'rgb(211, 75, 21)';
    if (probability >= 0.3) return 'rgb(224, 136, 35)';
    return '#000000'; // Default color for text
  };
  
  // Function to determine border color based on probability
  const getBorderColor = (probability) => {
    if (probability >= 0.3) return getProbabilityColor(probability);
    return '#CCCCCC'; // Default border color
  };


  return (
      <div
        style={getContainerStyle()}
      >
        <div
          style={{
            padding: '0px', // Move padding to inner container
          }}
        >
          {allEvents.map(event => {
            // Get probability for this event if available
           // console.log('Im inaide EventContainer, event',event);
            const probability = eventProbabilities[event.id];
            const probabilityValue = typeof probability === 'number' && Number.isFinite(probability) ? probability : 0;
            const formattedProb = formatProbability(probabilityValue);

            // Show graph if:
            // 1. On main tab (show all events) OR
            // 2. On specific event tab AND viewing "All Patterns" tab
            const shouldDisplayGraph = isMainTab || (event.id === selectedEvent && showAllPatterns);

            // Get dynamic styles based on probability
            const textColor = probabilityValue >= 0.3 ? getProbabilityColor(probabilityValue) : '#000000';
            const borderColor = getBorderColor(probabilityValue);
            
            // Get event active state for this event
            const isEventActive = eventActiveStates[event.id] ?? false;
            const isEventOccurred = eventOccurredStates[event.id] ?? false;
            const showActiveLabel = isEventOccurred && !isEventActive;
            
            const finalTextColor = showActiveLabel ? 'rgb(150, 0, 0)' : textColor;
            const finalBorderColor = showActiveLabel ? 'rgb(150, 0, 0)' : borderColor;

            // Adjust event card styling based on current state
            const getEventCardStyle = () => {
              const baseStyle = {
                display: shouldDisplayGraph ? 'block' : 'none',
                padding: '16px 16px',
                backgroundColor: 'rgb(219, 219, 219)',
                borderBottom: '0px solid rgb(255, 255, 255)',
                border: `2px solid ${finalBorderColor}`,
                borderRadius: '4px',
                transition: 'border-color 0.3s ease, border-width 0.3s ease',
              };

              // Single event "All Patterns" tab - minimize margins for exact fit
              if (!isMainTab && showAllPatterns) {
                return {
                  ...baseStyle,
                  marginBottom: '8px',
                  marginLeft: '0px',
                  marginRight: '4px',
                  marginTop: '0px',
                };
              }

              // Main tab or other states - keep normal margins
              return {
                ...baseStyle,
                marginBottom: '4px',
                marginLeft: '1px',
                marginRight: '4px',
                marginTop: '0px',
              };
            };

            return (
                <div
                  key={`event-${event.id}`}
                  style={getEventCardStyle()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h3 style={{ margin: 3, fontSize: '16px', lineHeight: '24px', height: '24px' }}>
                      {event.name?.replace(/_/g, ' ') || `Event ${event.id}`}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
                      {/* Fixed width probability display container */}
                      <div style={{
                        marginRight: '0px',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        padding: '0 6px',
                        backgroundColor: 'rgba(255, 255, 255, 0)',
                        display: 'flex',
                        minWidth: '130px',
                        alignItems: 'center',
                        height: '24px',
                        lineHeight: '24px',
                      }}>
                        <span style={{ marginRight: '5px' }}>Probability: </span>
                        <span style={{
                          width: '50px',
                          textAlign: 'right',
                          display: 'inline-block',
                          color: finalTextColor,
                          transition: 'color 0.3s ease',
                          fontWeight: 'bold'
                        }}>
                          {showActiveLabel ? 'Active' : formattedProb}
                        </span>
                      </div>
                      <IconButton
                        onClick={() => toggleExpand(event.id)}
                        size="small"
                        style={{ padding: '0', height: '24px', width: '24px' }}
                      >
                        {expandedEvents[event.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </div>
                  </div>

                  <div style={{
                    display: expandedEvents[event.id] ? 'block' : 'none',
                    transition: 'height 0.3s ease'
                  }}>
                    {/* {console.log('Im inaide EventContainer, event',event.id)} */}
                    <MainEventGraph
                      key={`graph-${event.id}-${graphKey}`}
                      eventId={event.id}
                      eventTitle={event.name || `Event ${event.id}`}
                      graphId={`event-graph-${event.id}`}
                      webSocketService={DataUpdateService}
                      probability_graph={probabilityValue}
                      tte_graph={eventTTEs[event.id]}
                      isEventActive={isEventActive}
                      isEventOccurred={isEventOccurred}
                    />
                  </div>
                </div>
            );
          })}
        </div>
      </div>
  );
}