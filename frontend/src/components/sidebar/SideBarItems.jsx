import React, { useState, useEffect } from 'react';
import SideBarItem from './SideBarItem';
import GraphButtonList from './GraphButtonList';
import EventPatternList from './EventPatternList';
import { FaBarsStaggered, FaVials, FaBedPulse, FaGear, FaUser, FaSyringe, FaCircle, FaHouse, FaChartLine, FaDroplet, FaFlask, FaLungs, FaGlassWaterDroplet, FaRegCircleQuestion, FaPenToSquare, FaXRay, FaWaveSquare, FaPersonWalking, FaStethoscope, FaGauge, FaUserGraduate } from 'react-icons/fa6';
import { FaRegQuestionCircle, FaRegEdit } from 'react-icons/fa';
import DataManagementService from '../dataService/DataManagementService';
import { useEventContext } from '../events/EventContext';
import { useVisibleGraphs } from '../graphs/GraphContext';
import { useRawData } from '../rawData/RawDataContext';
import PatientInfoModal from './PatientInfoModal';
import SettingsModal from './SettingsModal';
import ResearchModal from '../research/ResearchModal';
import PatternOverviewModal  from "./PatternOverviewModal";
import ManagerModal from './ManagerModal';
import UserStudyModal from './UserStudyModal';

const SideBarItems = ({ isExpanded, setSelectedPatternIndex, onItemClick }) => {
  const [typeStates, setTypeStates] = useState({});
  const [types, setTypes] = useState({});
  const [isPatternsOpen, setIsPatternsOpen] = useState(false);
  const { selectedEvent, setSelectedEvent, MAIN_TAB_ID, loadEventPatterns } = useEventContext();
  const eventId = selectedEvent === MAIN_TAB_ID ? 0 : selectedEvent;
  const { showOnlyGraphs } = useVisibleGraphs();
  const { setRawView, showRawDataType, expandedTypes, rawView, setExpandedTypes, setScrollToType } = useRawData();

  const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false);
  const [patientData, setPatientData] = useState(null);

  const [isPatternsInfoOpen, setIsPatternsInfoOpen] = useState(false);
  const [patternsData, setPatternsData] = useState([]);
  const [error, setError] = useState(null);

  const [isManagerOpen, setIsManagerOpen]         = useState(false);
  const [managerUnlocked, setManagerUnlocked]     = useState(false);   // after password OK

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResearchOpen, setIsResearchOpen] = useState(false);
  const [isUserStudyOpen, setIsUserStudyOpen]     = useState(false);



  const typeToIcon = {
    Labs:               <FaVials style={{ color: '#484949' }} />,
    'Blood Gas':        <FaDroplet style={{ color: '#484949' }} />,
    Chemistry:          <FaFlask style={{ color: '#484949' }} />,
    Respiratory:        <FaLungs style={{ color: '#484949' }} />,
    Output:             <FaGlassWaterDroplet style={{ color: '#484949' }} />,
    'Vital Signs':      <FaBedPulse style={{ color: '#484949' }} />,
    'Routine Vital Signs': <FaBedPulse style={{ color: '#484949' }} />, // alias
    Procedures:         <FaSyringe style={{ color: '#484949' }} />,
    Radiology:          <FaXRay style={{ color: '#484949' }} />,
    Hemodynamics:       <FaWaveSquare style={{ color: '#484949' }} />,
    Action:        <FaPersonWalking style={{ color: '#484949' }} />,
    Measurement:   <FaStethoscope style={{ color: '#484949' }} />,
    Slider:        <FaGauge style={{ color: '#484949' }} />,
  };
  

  // Fetch types and listen for entity/model changes
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        //console.log("Loading global temporal property types for sidebar");
        
        // Get all events
        const events = await DataManagementService.fetchAllEvents();
        const typeData = {};
        
        // For each event, fetch temporal property types
        for (const event of events) {
          try {
            const eventTypeData = await DataManagementService.fetchTemporalPropertyTypes(event.id);
            // Merge types from all events
            Object.entries(eventTypeData).forEach(([typeName, propertyIds]) => {
              if (!typeData[typeName]) {
                typeData[typeName] = [];
              }
              // Add unique property IDs
              propertyIds.forEach(id => {
                if (!typeData[typeName].includes(id)) {
                  typeData[typeName].push(id);
                }
              });
            });
          } catch (error) {
            console.error(`Error fetching types for event ${event.id}:`, error);
          }
        }
        
        // Sort types alphabetically
        const sortedTypes = Object.keys(typeData).sort().reduce((acc, key) => {
          acc[key] = typeData[key];
          return acc;
        }, {});
        
        setTypes(sortedTypes);
        const initialTypeStates = Object.keys(sortedTypes).reduce((acc, type) => {
          acc[type] = false;
          return acc;
        }, {});
        setTypeStates(initialTypeStates);
      } catch (error) {
        console.error(`Error fetching global types:`, error);
        setTypes({});
        setTypeStates({});
      }
    };

    fetchTypes();

    // Listen for entity/model changes to reset types
    const handleEntityModelChange = () => {
      // Clear existing types and states
      setTypes({});
      setTypeStates({});
      
      // Fetch new types after a short delay
      setTimeout(() => {
        fetchTypes();
      }, 500);
    };

    window.addEventListener('entity_model_changed', handleEntityModelChange);
    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, []); // Remove eventId dependency since we're now fetching globally

  // Close Events & Patterns when switching to Raw Data view
  useEffect(() => {
    if (rawView) {
      setIsPatternsOpen(false);
    }
  }, [rawView]);

  // Close Events & Patterns when switching to Main tab
  useEffect(() => {
    if (selectedEvent === MAIN_TAB_ID) {
      setIsPatternsOpen(false);
    }
  }, [selectedEvent, MAIN_TAB_ID]);

  // Clear all raw data button selections when leaving Raw Data tab
  useEffect(() => {
    if (!rawView) {
      setExpandedTypes({});
    }
  }, [rawView, setExpandedTypes]);

  const handleToggleType = (type) => {
    if (!isExpanded) onItemClick();
    
    // If we're in Raw Data view, toggle the expanded state
    if (rawView) {
      const isCurrentlyExpanded = expandedTypes[type];
      const newState = !isCurrentlyExpanded;
      
      setExpandedTypes(prev => ({
        ...prev,
        [type]: newState
      }));
      
      // If expanding (not collapsing), scroll to the section
      if (newState) {
        setScrollToType(type);
      }
    } else {
      // If not in Raw Data view, navigate to it and expand the type
      showRawDataType(type);
    }
  };

  const handleTogglePatterns = () => {
    if (!isExpanded) onItemClick();
    setIsPatternsOpen(!isPatternsOpen);
  };

  const handleHomeClick = () => {
    showOnlyGraphs([]);
    setSelectedEvent(MAIN_TAB_ID);
    loadEventPatterns(MAIN_TAB_ID);
    setRawView(false);
    setIsPatternsOpen(false); // Close Events & Patterns when going to Main
  };

  const handleManagerClick = () => {
    if (!isExpanded) onItemClick();
    setIsManagerOpen(true);
  };
  
  const handleUserStudyClick = () => {
      if (!isExpanded) onItemClick();
      setIsUserStudyOpen(true);
    };

  const fetchPatientInfo = async () => {
    try {
      const patient = await DataManagementService.fetchPatientInfo();
      setPatientData(patient);
      setIsPatientInfoOpen(true);
    } catch (err) {
      console.error("Error fetching patient info:", err.message);
      setError(err.message);
      setIsPatientInfoOpen(true);
    }
  };

  const fetchPatternInfo = async () => {
    try {
      const patterns = await DataManagementService.fetchAllPatternsInfo();
      setPatternsData(patterns);
      setIsPatternsInfoOpen(true);
    } catch (err) {
      console.error("Error fetching patient info:", err.message);
      setError(err.message);
      setIsPatternsInfoOpen(true);
    }
  };

  // Open Research Modal
  const openResearch = () => {
    if (!isExpanded) onItemClick();
    setIsResearchOpen(true);
    };

  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  // Format titles - now global, no event information needed
  const formatTypeTitle = (type) => {
    return type;
  };

  return (
    <div>
      {/* Research Category */}
      {isExpanded && (
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 'bold', 
          color: '#888', 
          padding: '0px 0px 4px 16px', 
          textTransform: 'uppercase',
          letterSpacing: '0.7px'
        }}>
          Research
        </div>
      )}

      {/* Home Button */}
      <div onClick={handleHomeClick}>
        <SideBarItem
          icon={<FaHouse style={{ color: '#484949' }} />}
          label="Main"
          isExpanded={isExpanded}
        />
      </div>

      {/* Patient Info */}
      <div onClick={fetchPatientInfo}>
        <SideBarItem
          icon={<FaUser style={{ color: '#484949' }} />}
          label="Patient Info"
          isExpanded={isExpanded}
        />
      </div>

      {isPatientInfoOpen && (
        <PatientInfoModal
          patientData={patientData}
          error={error}
          onClose={() => setIsPatientInfoOpen(false)}
        />
      )}

      {/* Events and Patterns */}
      <div
        onClick={handleTogglePatterns}
        style={{
          backgroundColor: (isPatternsOpen && !rawView && selectedEvent !== MAIN_TAB_ID) ? ' #F7F7F7' : 'transparent',
          borderRadius: '22px',
        }}
      >
        <SideBarItem
          icon={<FaBarsStaggered style={{ color: '#484949' }} />}
          label="Events & Patterns"
          isExpanded={isExpanded}
        />
      </div>

      {isExpanded && isPatternsOpen && (
        <EventPatternList isExpanded={isExpanded} />
      )}

      {/* Patterns Overview */}
      <div onClick={fetchPatternInfo}>
        <SideBarItem
            icon={<FaRegCircleQuestion/>}
            label="Pattern Overview"
            isExpanded={isExpanded}
        />
      </div>

      {isPatternsInfoOpen && (
          <PatternOverviewModal
              patterns={patternsData}
              error={error}
              onClose={() => setIsPatternsInfoOpen(false)}
          />
      )}

            {/* Research button */}
            <div onClick={openResearch}>
        <SideBarItem
          icon={<FaChartLine style={{ color: '#484949' }} />}
          label="Research"
          isExpanded={isExpanded}
        />
      </div>
       {isResearchOpen && (
         <ResearchModal onClose={() => setIsResearchOpen(false)} />
       )}


      {/* Raw Data Category */}
      {isExpanded && (
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 'bold', 
          color: '#888', 
          padding: '16px 0px 4px 16px', 
          textTransform: 'uppercase',
          letterSpacing: '0.7px'
        }}>
          Raw Data
        </div>
      )}

      {/* Dynamic Temporal Types */}
      {Object.entries(types).map(([type, graphIds]) => (
        <div key={type}>
          <div 
            onClick={() => handleToggleType(type)}
            style={{
              backgroundColor: (expandedTypes[type] && rawView) ? ' #F7F7F7' : 'transparent',
              borderRadius: '22px',
            }}
          >
            <SideBarItem
              icon={typeToIcon[type] || <FaCircle style={{ color: '#484949' }} />}
              label={formatTypeTitle(type)}
              isExpanded={isExpanded}
            />
          </div>
        </div>
      ))}

      {/* Settings Category */}
      {isExpanded && (
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 'bold', 
          color: '#888', 
          padding: '16px 0px 4px 16px', 
          textTransform: 'uppercase',
          letterSpacing: '0.7px'
        }}>
          Settings
        </div>
      )}

      {/* Settings Button */}
      <div onClick={openSettings}>
        <SideBarItem
            icon={<FaGear style={{color: '#484949'}}/>}
            label="Settings"
            isExpanded={isExpanded}
        />
      </div>

      {/* Render Settings Modal */}
      {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)}/>
      )}

      {/* Manager / Admin */}
      <div onClick={handleManagerClick}>
        <SideBarItem
          icon={<FaPenToSquare style={{ color: '#484949' }} />}
          label="Manager"
          isExpanded={isExpanded}
        />
      </div>

        {isManagerOpen && (
        <ManagerModal onClose={() => { setIsManagerOpen(false); setManagerUnlocked(false);} } />
        )}

      {/* User Study (password-gated) */}
      <div onClick={handleUserStudyClick}>
        <SideBarItem
          icon={<FaUserGraduate style={{ color: '#484949' }} />}
          label="User Study"
          isExpanded={isExpanded}
        />
      </div>
      {isUserStudyOpen && (
        <UserStudyModal onClose={() => setIsUserStudyOpen(false)} />
      )}

    </div>
  );
};

export default SideBarItems;

