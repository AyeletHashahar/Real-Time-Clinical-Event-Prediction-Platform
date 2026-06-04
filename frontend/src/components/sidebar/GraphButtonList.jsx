import { useVisibleGraphs } from '../graphs/GraphContext';
import DataManagementService from '../dataService/DataManagementService';
import { useEffect, useState } from 'react';
import { useEventContext } from '../events/EventContext';

const GraphButtonList = ({ graphIds }) => {
  const { toggleGraphVisibility, isGraphVisible } = useVisibleGraphs();
  const [temporalPropertyNames, setTemporalPropertyNames] = useState({});
  const [hoveredId, setHoveredId] = useState(null); // Track which button is hovered
  const { selectedEvent } = useEventContext(); // Get the current selected event
  const eventId = selectedEvent === 'main' ? 0 : selectedEvent;

  // Fetch labels and listen for entity/model changes
  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const labels = await DataManagementService.fetchTemporalPropertyLabels(eventId);
        setTemporalPropertyNames(labels);
      } catch (error) {
        console.error(`Error fetching temporal property labels for event ${eventId}:`, error);
        setTemporalPropertyNames({});
      }
    };

    fetchLabels();

    // Listen for entity/model changes to reset labels
    const handleEntityModelChange = () => {
      // Clear existing labels
      setTemporalPropertyNames({});
      
      // Fetch new labels after a short delay
      setTimeout(() => {
        fetchLabels();
      }, 500);
    };

    window.addEventListener('entity_model_changed', handleEntityModelChange);
    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, [eventId]); // Re-fetch when eventId changes

  return (
    <div className="graph-buttons" style={{ paddingLeft: '10px' }}>
      {/* Only render buttons for IDs that exist in graphIds */}
      {graphIds.map((id) => {
        const buttonLabel = temporalPropertyNames[id] || `Property ${id}`;
        // Add event info if not in main event
        const displayLabel = eventId !== 0 ? `${buttonLabel} (Event ${eventId})` : buttonLabel;
        const isVisible = isGraphVisible(id, eventId);
        
        return (
          <button
            key={id}
            onClick={() => toggleGraphVisibility(id, eventId)}
            onMouseEnter={() => setHoveredId(id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              backgroundColor: hoveredId === id 
                ? 'white' 
                : isVisible
                  ?  'rgba(247, 247, 247, 0.6)'
                  : '#E9EEF6',
              height: '24px',
              border: isVisible 
                ? '1px solid rgb(235, 235, 235)'
                : '0px solid #D3E3FD',
              color: '#484949',
              fontSize: '14px',
              textAlign: 'left',
              width: '100%',
              cursor: 'pointer',
              borderRadius: '22px',
              transition: 'background-color 0.3s ease',
            }}
          >
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
};

export default GraphButtonList;
