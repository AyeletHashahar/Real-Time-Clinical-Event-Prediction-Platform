import React, { useState, useEffect } from 'react';
import EventAndPatternTabs from './EventAndPatternTabs';
import logo from '../../assets/logo.png';
import DataManagementService from '../dataService/DataManagementService';
import LiorInfoModal from "@/components/topbar/LiorInfoModal";

const AppBarComponent = () => {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Load initial entity and listen for changes
  useEffect(() => {
    const loadInitialEntityFromSelection = async () => {
      try {
        // Get current selection instead of fetching entities directly
        const currentSelection = await DataManagementService.fetchCurrentSelection();
        if (currentSelection && currentSelection.entity_id) {
          setSelectedEntity(currentSelection.entity_id);
        }
      } catch (error) {
        console.error('Error loading current entity selection:', error);
      }
    };

    loadInitialEntityFromSelection();

    // Listen for entity/model changes
    const handleEntityModelChange = () => {
      const entityId = localStorage.getItem('entity_id');
      if (entityId) {
        setSelectedEntity(entityId);
      }
    };

    window.addEventListener('entity_model_changed', handleEntityModelChange);

    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, []);

  return (
    <div>
      {/* Top padding with same color as AppBar */}
      <div style={{
        backgroundColor: '#E9EEF6',
        width: '100%',
        height: '4px',
      }} />
      
      <div style={{
        backgroundColor: '#E9EEF6',
        width: '100%',
        borderBottom: '4px solid rgb(255, 255, 255)',
        fontFamily: 'Quicksand, sans-serif',
        fontWeight: 'bold',
        position: 'relative',
      }}>
        {/* Container for entity ID and logo */}
        <div style={{ 
          position: 'absolute',
          right: '15px',
          top: '0px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '7px', // Add spacing between entity ID and logo
        }}>
          {/* Entity ID Display */}
          {selectedEntity && (
            <div style={{
              fontSize: '16px',
              color: '#7f7f7f',
              padding: '5px 10px',
              backgroundColor: 'rgba(0, 0, 0, 0)',
            }}>
              Patient ID: {selectedEntity}
            </div>
          )}

          {/* Logo – clickable button */}
          <div style={{position: 'relative', display: 'inline-block'}}>
             <img
               src={logo}
               alt="App Logo"
               style={{
                 height: '45px',
                 width: 'auto',
                 display: 'block',
                 pointerEvents: 'none',
              }}
             />
             <button
               onClick={() => setAboutOpen(true)}
               title="About LIOR"
               style={{
                 position: 'absolute',
                 top: 0,
                 left: 0,
                 width: '50%',
                 height: '100%',
                 background: 'transparent',
                 border: 'none',
                 cursor: 'pointer',
                 padding: 0,
              }}
             />
          </div>
        </div>

        {/* Tabs section - full width */}
        <EventAndPatternTabs/>

        <LiorInfoModal
            open={aboutOpen}
            onClose={() => setAboutOpen(false)}
        />
      </div>
    </div>
  );
};

export default AppBarComponent;