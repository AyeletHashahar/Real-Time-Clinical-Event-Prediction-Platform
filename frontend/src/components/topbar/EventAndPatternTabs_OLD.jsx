import React, { useCallback, useEffect, useState, useRef } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import { useEventContext } from '../events/EventContext';
import { usePatternContext } from '../patterns/PatternContext';
import { useVisibleGraphs } from '../graphs/GraphContext';
import { useRawData }     from '../rawData/RawDataContext';
import RawDataView from '../rawData/RawDataView'; // Import the RawDataView component
import DataUpdateService from '../dataService/DataUpdateService'; // Import DataUpdateService
import logo from '../../assets/logo.png'; // Import the logo here

const EventAndPatternTabs = () => {
  const { 
    selectedEvent, 
    setSelectedEvent, 
    events, 
    loadEventPatterns,
    eventPatterns,
    MAIN_TAB_ID 
  } = useEventContext();
  
  const { 
    selectedPatternIndex, 
    setSelectedPatternIndex 
  } = usePatternContext();

  const { showOnlyGraphs } = useVisibleGraphs();
  const { rawView, setRawView } = useRawData();
  
  // Add state for tracking event active states
  const [eventActiveStates, setEventActiveStates] = useState({});
  // Add state for tracking event probabilities
  const [eventProbabilities, setEventProbabilities] = useState({});
  // Track active listeners
  const activeListenersRef = useRef([]);

  // Function to determine color based on probability (same as EventContainer)
  const getProbabilityColor = (probability) => {
    if (probability >= 0.55) return 'rgb(202, 18, 18)';
    if (probability >= 0.45) return 'rgb(211, 75, 21)';
    if (probability >= 0.3) return 'rgb(224, 136, 35)';
    return '#7F7F7F'; // Default color for text
  };

  // Set up event active listeners and probability listeners for all events
  useEffect(() => {
    const cleanupListeners = () => {
      activeListenersRef.current.forEach(({ eventId, callback, type }) => {
        if (type === 'active') {
          DataUpdateService.removeEventActiveListener(eventId, callback);
        } else if (type === 'probability') {
          DataUpdateService.removeProbabilityListener(eventId, callback);
        }
      });
      activeListenersRef.current = [];
    };

    const setupListeners = () => {
      // Cleanup existing listeners first
      cleanupListeners();
      
      // Array to track new listeners
      const newListeners = [];
      
      events.forEach(event => {
        // Create event-specific active state handler
        const handleEventActiveUpdate = (isActive) => {
          setEventActiveStates(prev => ({
            ...prev,
            [event.id]: isActive
          }));
        };
        
        // Create event-specific probability handler
        const handleProbabilityUpdate = (prediction) => {
          setEventProbabilities(prev => ({
            ...prev,
            [event.id]: prediction
          }));
        };
        
        // Add event active listener
        DataUpdateService.addEventActiveListener(event.id, handleEventActiveUpdate);
        // Add probability listener
        DataUpdateService.addProbabilityListener(event.id, handleProbabilityUpdate);
        
        // Save references to the listeners for cleanup
        newListeners.push({ eventId: event.id, callback: handleEventActiveUpdate, type: 'active' });
        newListeners.push({ eventId: event.id, callback: handleProbabilityUpdate, type: 'probability' });
      });
      
      // Store active listeners
      activeListenersRef.current = newListeners;
    };

    if (events.length > 0) {
      setupListeners();
    }

    // Cleanup on unmount
    return () => {
      cleanupListeners();
    };
  }, [events]);

  // Hide all graphs when changing event tab
  const handleEventChange = useCallback((event, newValue) => {
    if (newValue === 'raw') {
      setRawView(true);
      // When switching to Raw Data tab, reset selectedEvent to ensure proper tab highlighting
      setSelectedEvent(null);
      return;
    }
    setRawView(false);
    // Hide all graphs for the current event first
    const currentEventId = selectedEvent === MAIN_TAB_ID ? 0 : selectedEvent;
    showOnlyGraphs([], currentEventId);
    
    // Also hide graphs for the new event to ensure clean state
    const newEventId = newValue === MAIN_TAB_ID ? 0 : newValue;
    if (newEventId !== currentEventId) {
      showOnlyGraphs([], newEventId);
    }
    
    setSelectedEvent(newValue);
    setSelectedPatternIndex(null);
    
    // Don't reload the patterns, they should already be loaded or will load on demand
    // We're removing this call to prevent recreation of pattern components
    // if (newValue !== null) {
    //   loadEventPatterns(newValue);
    // }
  }, [setSelectedEvent, setSelectedPatternIndex, showOnlyGraphs, selectedEvent, MAIN_TAB_ID, setRawView]);

  // Hide all graphs when changing pattern tab
  const handlePatternChange = useCallback((event, newValue) => {
    // Hide all graphs by passing empty array with the correct eventId
    const eventId = selectedEvent === MAIN_TAB_ID ? 0 : selectedEvent;
    showOnlyGraphs([], eventId);
    
    setSelectedPatternIndex(newValue === 'all' ? null : parseInt(newValue));
  }, [setSelectedPatternIndex, showOnlyGraphs, selectedEvent, MAIN_TAB_ID]);

  // Get pattern tabs for the selected event
  const getPatternTabs = () => {
    if (selectedEvent === MAIN_TAB_ID || !eventPatterns[selectedEvent] || rawView) {
      return null;
    }

    const patterns = eventPatterns[selectedEvent];
    
    return (
      <Box sx={{ 
        borderBottom: 0, 
        borderColor: 'rgb(255, 255, 255)',
        backgroundColor: 'rgb(255, 255, 255)',
        height: '38px',
        paddingTop: '4px', // Add this line to create space between the two tab sets
      }}>
        <Tabs
          value={selectedPatternIndex === null ? 'all' : selectedPatternIndex.toString()}
          onChange={handlePatternChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: '34px',
            height: '34px',
            backgroundColor: '#FFFFFF', // #E9EEF6
            '& .MuiTab-root': {
              marginTop: '2px',
              marginBottom: '2px',
              minHeight: '30px',
              height: '30px',
              padding: '12px 12px',
              minWidth: '130px',
              color: ' #7F7F7F',
              fontSize: '14px',
              '&.Mui-selected': {
                color: '#7F7F7F',
                fontWeight: 'bold',
                backgroundColor: ' #F7F7F7', // rgb(211, 227, 253)
                // borderTopLeftRadius: '4px',
                // borderTopRightRadius: '4px',
                borderRadius: '20px',
                border: '1px solid #cccccc', // Add this line to create a border
              },
              fontFamily: 'Quicksand, sans-serif',
              textTransform: 'none',
            },
          }}
          TabIndicatorProps={{
            style: {
              backgroundColor: 'rgba(255, 255, 255, 0)',
              height: 4,
            },
          }}
        >
          <Tab 
            label="All Patterns" 
            value="all"
            disableRipple
            sx={{
              fontSize: '14px',
              fontWeight: selectedPatternIndex === null ? 'bold' : 'normal',
            }}
          />
          {Object.keys(patterns).map((patternId) => (
            <Tab 
              key={patternId}
              label={`Pattern ${patternId}`}
              value={patternId}
              disableRipple
              sx={{
                fontSize: '14px',
                fontWeight: selectedPatternIndex === parseInt(patternId) ? 'bold' : 'normal',
              }}
            />
          ))}
        </Tabs>
      </Box>
    );
  };

  return (
    <Box>
      {/* Event Tabs */}
      <Box sx={{ 
        width: '100%',
        height: '40px',
        marginLeft: '0px',
      }}>
        
        <Tabs 
          value={rawView ? 'raw' : selectedEvent}
          onChange={handleEventChange}
          sx={{
            minHeight: '40px',
            height: '40px',
            backgroundColor: '#E9EEF6',
            '& .MuiTab-root': {
              marginTop: '2px',
              marginBottom: '2px',
              minHeight: '40px',
              height: '40px',
              padding: '0px 12px',
              minWidth: '130px',
              color: '#7F7F7F',
              fontSize: '14px',
              '&.Mui-selected': {
                color: '#000000', // ' #7F7F7F' , // '#000000', #484949
                fontWeight: 'bold',
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
              },
              fontFamily: 'Quicksand, sans-serif',
              textTransform: 'none',
            },
          }}
          TabIndicatorProps={{
            style: {
              backgroundColor: 'rgba(255, 255, 255, 0)',
              height: 0,
            },
          }}
        >
          {/* Main tab is always first */}
          <Tab 
            label="Main"
            value={MAIN_TAB_ID}
            disableRipple
            sx={{
              fontSize: '14px',
              fontWeight: !rawView && selectedEvent === MAIN_TAB_ID ? 'bold' : 'normal',
            }}
          />
          
          {/* Event tabs */}
          {events.map((event) => {
            const isEventActive = eventActiveStates[event.id] ?? false;
            const probability = eventProbabilities[event.id] ?? 0;
            const formattedProb = probability !== undefined ? `${(probability * 100).toFixed(1)}%` : '0.0%';
            const probabilityColor = getProbabilityColor(probability);
            
            // Only show probability for the selected event tab
            const isSelectedEvent = !rawView && selectedEvent === event.id;
            
            // Create custom label with event name and probability (only for selected tab)
            const tabLabel = isSelectedEvent ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                lineHeight: '1.2'
              }}>
                <span style={{ fontSize: '14px' }}>{event.name}</span>
                <span style={{ 
                  fontSize: '10px', 
                  color: isEventActive ? 'rgb(150, 0, 0)' : probabilityColor,
                  fontWeight: isEventActive ? 'bold' : 'normal',
                  marginTop: '1px'
                }}>
                  {isEventActive ? 'Active' : formattedProb}
                </span>
              </div>
            ) : event.name; // Just show event name for non-selected tabs
            
            return (
              <Tab 
                key={event.id}
                label={tabLabel}
                value={event.id}
                disableRipple
                sx={{
                  fontSize: '14px',
                  fontWeight: !rawView && selectedEvent === event.id ? 'bold' : (isEventActive ? 'bold' : 'normal'),
                  color: isEventActive ? 'rgb(150, 0, 0) !important' : '#7F7F7F',
                  '&.Mui-selected': {
                    color: isEventActive ? 'rgb(150, 0, 0) !important' : '#000000',
                    fontWeight: 'bold',
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                  },
                }}
              />
            );
          })}

          {/* RAW-DATA TAB */}
          <Tab
            label="Raw Data"
            value="raw"
            disableRipple
            sx={{
              fontSize: '14px',
              minWidth: '110px',
              fontWeight: rawView ? 'bold' : 'normal',
            }}
          />
        </Tabs>
        {/* Add logo here
        <img
          src={logo}
          alt="App Logo"
          style={{ 
            height: '15px', // Adjust size to fit with tabs
            width: 'auto', 
            marginRight: '15px',
            marginLeft: '10px',
          }}
        /> */}
      </Box>
      
      {/* Pattern Tabs - Only show when an event is selected and not in Raw Data view */}
      {getPatternTabs()}
      
      {/* Display RawDataView when Raw Data tab is selected */}
      {rawView && <RawDataView />}
    </Box>
  );
};

export default EventAndPatternTabs;