import { useEffect, useState } from 'react';
import GraphIntervals from './GraphIntervals';
import { useVisibleGraphs } from './GraphContext';
import DataUpdateService from '../dataService/DataUpdateService';
import DataManagementService from '../dataService/DataManagementService';
import { useEventContext } from '../events/EventContext';
// import GraphIntervalsCombined from "./GraphIntervalsCombined";
import { useRawData } from '../rawData/RawDataContext'; // Import RawDataContext
import GraphIntervalsOverlay from "./GraphIntervalsOverlay";
import UniformIntervalsChart from "./UniformIntervalsChart";


// Which graph renderer to use (set by UserStudyModal)
const getSelectedRenderer = () => sessionStorage.getItem("graphRenderer") || "legacy";

const GraphContainer = () => {
  const { getVisibleGraphsForEvent, getHighlightedIntervals, getVisibleGraphsInOrder } = useVisibleGraphs();
  const { selectedEvent } = useEventContext();
  const { rawView } = useRawData(); // Get rawView state
  const [graphData, setGraphData] = useState({});
  const [storedGraphData, setStoredGraphData] = useState({});
  const [propertyIds, setPropertyIds] = useState([]);
  const [eventId, setEventId] = useState(0); // Default to event 0 if none selected

  // Set current event ID when the selected event changes
  useEffect(() => {
    // If selectedEvent is MAIN_TAB_ID, use event 0
    // Otherwise use the actual selected event
    if (selectedEvent === 'main') {
      setEventId(0);
    } else {
      setEventId(selectedEvent);
    }
  }, [selectedEvent]);

  // Load property IDs and reload on entity/model changes
  useEffect(() => {
    // Fetch the property IDs
    const getPropertyIds = async () => {
      // Only fetch if we have a valid eventId
      if (eventId !== null && eventId !== undefined) {
        const ids = await DataManagementService.fetchTemporalPropertyIds(eventId);
        setPropertyIds(ids);
      }
    };

    if (eventId !== null && eventId !== undefined) {
      getPropertyIds();
    }

    // Set up listener for entity/model changes
    const handleEntityModelChange = () => {
      // Clear existing data
      setGraphData({});
      setStoredGraphData({});
      setPropertyIds([]);

      // Fetch new data after a short delay
      setTimeout(() => {
        getPropertyIds();
      }, 500);
    };

    // Listen for entity/model changes
    window.addEventListener('entity_model_changed', handleEntityModelChange);

    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, [eventId]); // Dependency on eventId to reload when it changes

  // Load graph data when property IDs change
  useEffect(() => {
    const fetchData = async () => {
      if (eventId === null || eventId === undefined) return;

      const newGraphData = {};
      for (const propertyId of propertyIds) {
        const title = await DataManagementService.fetchTitle(propertyId, eventId);
        const states = await DataManagementService.fetchStates(propertyId, eventId);
        newGraphData[propertyId] = { title, states };
      }
      setGraphData(newGraphData);
    };

    if (propertyIds.length > 0) {
      fetchData();
    }
  }, [propertyIds, eventId]); // This will re-run when propertyIds or eventId changes

  const handleGraphVisibility = (propertyId) => {
    if (eventId === null || eventId === undefined) return;

    const data = DataUpdateService.getStoredData(propertyId, eventId);
    setStoredGraphData((prev) => ({
      ...prev,
      [`${eventId}-${propertyId}`]: data, // Use composite key for stored data
    }));
  };

  // If no event ID or in raw view mode, don't render anything
  if (eventId === null || eventId === undefined || rawView) {
    return null;
  }

  // Get visible graphs for the current event in the order they were made visible
  const visibleGraphsInOrder = getVisibleGraphsInOrder(eventId);

  return (
    <div className="main-content" style={{ flex: 1, width: '100%'}}>
      <main className="graph-container-overlay">
          {visibleGraphsInOrder.map((propertyId) => {
          const graphKey = `${eventId}-${propertyId}`;
          const highlightedIntervals = getHighlightedIntervals(eventId, propertyId);
          const renderer = getSelectedRenderer(); // <— read choice

          return (
            <div key={graphKey} style={{
              border: '2px solid #E0E0E0',
              borderRadius: '4px',
              marginBottom: '4px',
              marginLeft: '1px',
              marginRight: '4px',
              paddingRight: '16px',
              paddingLeft: '16px'
            }}>
              {renderer === "uniform" && (
                <UniformIntervalsChart
                  temporalPropertyIdToShow={propertyId}
                  graphId={`graph-${propertyId}-${eventId}`}
                  DataUpdateService={DataUpdateService}
                  title={graphData[propertyId]?.title || `Property ${propertyId} (Event ${eventId})`}
                  states={graphData[propertyId]?.states || []}
                  initialData={storedGraphData[graphKey] || []}
                  onVisibilityChange={() => handleGraphVisibility(propertyId)}
                  isVisible={true}
                  eventId={eventId}
                  highlightedIntervals={highlightedIntervals}
                  uniformBinHeights={true}
                  binGapPx={4}
                />
              )}

              {renderer === "overlay" && (
                <GraphIntervalsOverlay
                  temporalPropertyIdToShow={propertyId}
                  graphId={`graph-${propertyId}-${eventId}`}
                  DataUpdateService={DataUpdateService}
                  title={graphData[propertyId]?.title || `Property ${propertyId} (Event ${eventId})`}
                  states={graphData[propertyId]?.states || []}
                  initialData={storedGraphData[graphKey] || []}
                  onVisibilityChange={() => handleGraphVisibility(propertyId)}
                  isVisible={true}
                  eventId={eventId}
                  highlightedIntervals={highlightedIntervals}
                />
              )}

              {renderer === "legacy" && (
                <GraphIntervals
                  temporalPropertyIdToShow={propertyId}
                  graphId={`graph-${propertyId}-${eventId}`}
                  DataUpdateService={DataUpdateService}
                  title={graphData[propertyId]?.title || `Property ${propertyId} (Event ${eventId})`}
                  states={graphData[propertyId]?.states || []}
                  initialData={storedGraphData[graphKey] || []}
                  onVisibilityChange={() => handleGraphVisibility(propertyId)}
                  isVisible={true}
                  eventId={eventId}
                  highlightedIntervals={highlightedIntervals}
                />
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default GraphContainer;