import React from 'react';
import DataUpdateService from '../dataService/DataUpdateService';
import DataManagementService from '../dataService/DataManagementService';
import { useEventContext } from '../events/EventContext';
import { usePatternContext } from '../patterns/PatternContext';
import { useVisibleGraphs } from '../graphs/GraphContext';
import { useRawData } from '../rawData/RawDataContext';

const StartDemoButton = ({
  selectedEvents,
  selectedEntity,
  onStartSuccess,
  className,
  style
}) => {
  // Get context functions to reset states
  const eventContext = useEventContext();
  const patternContext = usePatternContext();
  const visibleGraphsContext = useVisibleGraphs();
  const { setRawView } = useRawData();

  const handleStartDemo = async () => {
    try {
      // First trigger the loading screen by calling onStartSuccess
      // This will close the settings modal and show the loading screen
      if (onStartSuccess) {
        onStartSuccess();
      }
      
      // 1. Send the selected model and entity to the backend using DataManagementService
      await DataManagementService.selectEntityAndEvents(selectedEntity, selectedEvents);

      // 2. Save selected model and entity to localStorage
      localStorage.setItem('entity_id', selectedEntity);
      localStorage.setItem('events_list', selectedEvents);

      // 3. Reset all data in DataManagementService
      DataManagementService.resetAllData();

      // 4. Reset all UI contexts
      if (eventContext) {
        eventContext.setSelectedEvent(eventContext.MAIN_TAB_ID);
        eventContext.setEventPatterns({});
        eventContext.setEvents([]);
        eventContext.clearGraphs();
      }

      if (patternContext) {
        patternContext.setSelectedPatternIndex(null);
      }

      if (visibleGraphsContext) {
        visibleGraphsContext.showOnlyGraphs([]);
      }

      // Exit Raw Data tab if currently selected
      if (setRawView) {
        setRawView(false);
      }

      // 5. Clear data and restart data fetching for new entity/model
      DataUpdateService.clearAllData();
      DataUpdateService.connect();

      // Dispatch a custom event to notify components of entity/model change
      const entityModelChangedEvent = new CustomEvent('entity_model_changed', {
        detail: { entity: selectedEntity, model: selectedEvents }
      });
      window.dispatchEvent(entityModelChangedEvent);

    } catch (error) {
      console.error('Failed to start with selected settings:', error);
    }
  };

  return (
    <button
      onClick={handleStartDemo}
      disabled={!selectedEvents || !selectedEntity}
      className={className}
      style={{
        opacity: (!selectedEvents || !selectedEntity) ? 0.5 : 1,
        ...style
      }}
    >
      Start
    </button>
  );
};

export default StartDemoButton;