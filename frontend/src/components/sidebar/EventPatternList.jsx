import React, { useState } from 'react';
import { useEventContext } from '../events/EventContext';
import { usePatternContext } from '../patterns/PatternContext';
import { useVisibleGraphs } from '../graphs/GraphContext';
import { useRawData } from '../rawData/RawDataContext';
import { FaChevronRight } from 'react-icons/fa6';

const EventPatternList = ({ isExpanded }) => {
  const { selectedEvent, eventPatterns, events, setSelectedEvent, loadEventPatterns } = useEventContext();
  const { selectedPatternIndex, setSelectedPatternIndex } = usePatternContext();
  const { showOnlyGraphs } = useVisibleGraphs();
  const { setRawView } = useRawData();
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [hoveredPattern, setHoveredPattern] = useState(null);

  if (!isExpanded || !events || events.length === 0) return null;

  return (
    <div className="event-pattern-list" style={{ paddingLeft: '10px' }}>
      {events.map((event) => (
        <div key={event.id} style={{ marginBottom: '4px' }}>
          <button
            onClick={() => {
              // Hide all graphs when clicking event
              showOnlyGraphs([]);
              
              setSelectedEvent(event.id);
              setSelectedPatternIndex(null);
              loadEventPatterns(event.id);
              setRawView(false); // Navigate away from Raw Data
            }}
            onMouseEnter={() => setHoveredEvent(event.id)}
            onMouseLeave={() => setHoveredEvent(null)}
            style={{
              backgroundColor: hoveredEvent === event.id 
                ? 'white' 
                : selectedEvent === event.id 
                  ? 'rgba(247, 247, 247, 0.6)' 
                  : '#E9EEF6',
              height: '24px',
              border: selectedEvent === event.id 
                ? '1px solid rgb(235, 235, 235)' 
                : '0px solid #D3E3FD',
              color: '#484949',
              fontSize: '14px',
              fontFamily: 'Quicksand, sans-serif',
              textAlign: 'left',
              width: '100%',
              cursor: 'pointer',
              borderRadius: '22px',
              transition: 'background-color 0.3s ease',
              marginBottom: '2px',
              paddingLeft: '10px',
              fontWeight: '400',
            }}
          >
            {event.name.replace(/_/g, ' ')}
          </button>
          
          {/* Pattern buttons with the same styling as event buttons */}
          {selectedEvent === event.id && eventPatterns[event.id] && (
            <div style={{ paddingLeft: '15px', marginTop: '4px' }}>
              {Object.keys(eventPatterns[event.id]).map((patternId) => {
                const isSelected = selectedPatternIndex === parseInt(patternId);
                return (
                  <div 
                    key={patternId}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      marginBottom: '2px',
                    }}
                  >
                    {isSelected && (
                      <FaChevronRight 
                        size={10} 
                        style={{ 
                          marginRight: '5px',
                          color: ' #484949'
                        }} 
                      />
                    )}
                    <button
                      onClick={() => {
                        // Hide all graphs when clicking pattern
                        showOnlyGraphs([]);
                        
                        setSelectedPatternIndex(parseInt(patternId));
                        setRawView(false); // Navigate away from Raw Data
                      }}
                      onMouseEnter={() => setHoveredPattern(parseInt(patternId))}
                      onMouseLeave={() => setHoveredPattern(null)}
                      style={{
                        backgroundColor: hoveredPattern === parseInt(patternId) 
                          ? 'white' 
                          : isSelected  
                            ? '#E9EEF6' // 'rgba(211, 227, 253, 0.5)' 
                            : '#E9EEF6',
                        height: '24px',
                        border: isSelected 
                          ? '0px solid #D3E3FD' 
                          : '0px solid #D3E3FD',
                        color: ' #484949',
                        fontSize: '14px',
                        fontFamily: 'Quicksand, sans-serif',
                        textAlign: 'left',
                        width: '100%',
                        cursor: 'pointer',
                        borderRadius: '22px',
                        transition: 'background-color 0.3s ease',
                        paddingLeft: '10px',
                        fontWeight: isSelected ? 'bold' : '400',
                      }}
                    >
                      Pattern {patternId}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default EventPatternList;