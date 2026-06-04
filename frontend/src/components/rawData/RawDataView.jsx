import React, { useEffect, useState, useRef } from 'react';
import RawDataGraph from './RawDataGraph';
import DataUpdateService from '../dataService/DataUpdateService';
import DataManagementService from '../dataService/DataManagementService';
import { useRawData } from '../rawData/RawDataContext';

// Import icons for different temporal property types (same as SideBarItems.jsx)
import { 
  FaVials, 
  FaBedPulse, 
  FaSyringe, 
  FaCircle, 
  FaDroplet, 
  FaFlask, 
  FaLungs, 
  FaGlassWaterDroplet, 
  FaXRay,
  FaWaveSquare,
  FaPersonWalking,
  FaStethoscope,
  FaGauge
} from 'react-icons/fa6';

const RawDataView = () => {
  const [allTemporalProperties, setAllTemporalProperties] = useState([]);
  const [graphData, setGraphData] = useState({});
  const [storedGraphData, setStoredGraphData] = useState({});
  const [loading, setLoading] = useState(true);
  const [propertyLabels, setPropertyLabels] = useState({});
  const [propertyToTypeMap, setPropertyToTypeMap] = useState({}); // Map property ID to type
  const [typeStates, setTypeStates] = useState({}); // Track which types are expanded
  const [searchQuery, setSearchQuery] = useState(''); // Add search functionality
  const { rawView, selectedRawDataType, setSelectedRawDataType, expandedTypes, setExpandedTypes, scrollToType, setScrollToType } = useRawData();
  
  // Refs for scrolling to type sections
  const typeRefs = useRef({});
  const scrollContainerRef = useRef(null); // Ref for the scrollable graph-container
  
  // Icon mapping for different temporal property types (same as SideBarItems.jsx)
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
  
  // Load all unique temporal properties across all events
  useEffect(() => {
    const loadAllTemporalProperties = async () => {
      try {
        setLoading(true);
        //console.log("Loading all temporal properties for raw data view");
        
        // Get all events
        const events = await DataManagementService.fetchAllEvents();
        //console.log(`Found ${events.length} events`);
        
        // Create a Set to store unique temporal property IDs
        const uniqueTemporalPropertyIds = new Set();
        const propToTypeMapping = {};
        
        // For each event, fetch temporal property IDs and types
        for (const event of events) {
         // console.log(`Fetching properties for event ${event.id}`);
          const propertyIds = await DataManagementService.fetchTemporalPropertyIds(event.id);
          //console.log(`Found ${propertyIds.length} properties for event ${event.id}`);
          propertyIds.forEach(id => uniqueTemporalPropertyIds.add(id));
          
          // Fetch type information for this event
          try {
            const typeData = await DataManagementService.fetchTemporalPropertyTypes(event.id);
            // Create reverse mapping from property ID to type
            Object.entries(typeData).forEach(([typeName, propertyIds]) => {
              propertyIds.forEach(propertyId => {
                propToTypeMapping[propertyId] = typeName;
              });
            });
          } catch (error) {
            console.error(`Error fetching types for event ${event.id}:`, error);
          }
        }
        
        // Convert Set to Array and set state
        const propertiesArray = Array.from(uniqueTemporalPropertyIds);
        //console.log(`Total unique temporal properties: ${propertiesArray.length}`);
        setAllTemporalProperties(propertiesArray);
        setPropertyToTypeMap(propToTypeMapping);
        
        // Initialize all type states to closed (false)
        const uniqueTypes = [...new Set(Object.values(propToTypeMapping))];
        const initialTypeStates = {};
        uniqueTypes.forEach(type => {
          initialTypeStates[type] = false; // Start with all categories closed
        });
        setTypeStates(initialTypeStates);
        
        // Pre-load stored data for all properties
        const newStoredData = {};
        for (const propertyId of propertiesArray) {
          // Try to get data from event 0 first (main event)
          let data = DataUpdateService.getStoredData(propertyId, 0);
          
          // If no data in event 0, try to find data in any event
          if (!data || data.length === 0) {
            for (const event of events) {
              data = DataUpdateService.getStoredData(propertyId, event.id);
              if (data && data.length > 0) {
                console.log(`Found data for property ${propertyId} in event ${event.id}`);
                break;
              }
            }
          }
          
          newStoredData[propertyId] = data || [];
        }
        
        setStoredGraphData(newStoredData);
        
        // Fetch property labels for all events and combine them
        const allLabels = {};
        for (const event of events) {
          try {
            const labels = await DataManagementService.fetchTemporalPropertyLabels(event.id);
            // Merge labels from this event with the combined labels
            Object.assign(allLabels, labels);
          } catch (error) {
            console.error(`Error fetching labels for event ${event.id}:`, error);
          }
        }
        
        setPropertyLabels(allLabels);
        setLoading(false);
      } catch (error) {
        console.error('Error loading temporal properties:', error);
        setLoading(false);
      }
    };
    
    loadAllTemporalProperties();
  }, []);

  // Handle selectedRawDataType from sidebar navigation
  useEffect(() => {
    if (selectedRawDataType && typeStates[selectedRawDataType] !== undefined) {
      setTypeStates(prev => ({
        ...prev,
        [selectedRawDataType]: true
      }));
      
      // Sync with global context for sidebar
      setExpandedTypes(prev => ({
        ...prev,
        [selectedRawDataType]: true
      }));
      
      // Scroll to the expanded section after a delay
      setTimeout(() => {
        scrollToExpandedType(selectedRawDataType);
      }, 400);
      
      // Clear the selected type after expanding it
      setSelectedRawDataType(null);
    }
  }, [selectedRawDataType, typeStates, setSelectedRawDataType, setExpandedTypes]);
  
  // Clear all raw data button selections when leaving Raw Data tab
  useEffect(() => {
    if (!rawView) {
      setExpandedTypes({});
    }
  }, [rawView, setExpandedTypes]);
  
  // Sync changes from sidebar back to local typeStates
  useEffect(() => {
    if (rawView) {
      setTypeStates(expandedTypes);
    }
  }, [expandedTypes, rawView]);
  
  // Handle scrolling when scrollToType is set (from sidebar)
  useEffect(() => {
    if (scrollToType && rawView) {
      // Use a timeout to ensure the type is expanded first
      setTimeout(() => {
        scrollToExpandedType(scrollToType);
        setScrollToType(null); // Clear after scrolling
      }, 300);
    }
  }, [scrollToType, rawView, setScrollToType]);
  
  // Load graph data for all temporal properties
  useEffect(() => {
    const fetchData = async () => {
      const newGraphData = {};
      
      for (const propertyId of allTemporalProperties) {
        try {
          // Use event ID 0 (main) for fetching data as raw data is the same across events
          const title = await DataManagementService.fetchTitle(propertyId, 0);
          const states = await DataManagementService.fetchStates(propertyId, 0);
          newGraphData[propertyId] = { title, states };
        } catch (error) {
          console.error(`Error fetching data for property ${propertyId}:`, error);
          newGraphData[propertyId] = { 
            title: `Property ${propertyId}`, 
            states: [] 
          };
        }
      }
      
      setGraphData(newGraphData);
    };
    
    if (allTemporalProperties.length > 0) {
      fetchData();
    }
  }, [allTemporalProperties]);
  
  // Get title for a property, using labels if available
  const getPropertyTitle = (propertyId) => {
    // First try to use the property label if available
    if (propertyLabels && propertyLabels[propertyId]) {
      return propertyLabels[propertyId];
    }
    
    // Then try to use the title from graph data
    if (graphData[propertyId]?.title) {
      return graphData[propertyId].title;
    }
    
    // Fall back to default title
    return `Property ${propertyId} (Raw Data)`;
  };
  
  // Handle graph visibility - fetch data when a graph becomes visible
  const handleGraphVisibility = (propertyId) => {
    // For raw data, try all events to find data
    const fetchDataFromAllEvents = async () => {
      // First try event 0 (main)
      let data = DataUpdateService.getStoredData(propertyId, 0);
      
      // If no data found, try all events
      if (!data || data.length === 0) {
        const events = await DataManagementService.fetchAllEvents();
        for (const event of events) {
          data = DataUpdateService.getStoredData(propertyId, event.id);
          if (data && data.length > 0) {
            //console.log(`Found data for property ${propertyId} in event ${event.id}`);
            break;
          }
        }
      }
      
      setStoredGraphData((prev) => ({
        ...prev,
        [propertyId]: data || [],
      }));
    };
    
    fetchDataFromAllEvents();
  };
  
  // Toggle type expansion/collapse
  const handleToggleType = (typeName) => {
    const newState = !typeStates[typeName];
    
    setTypeStates(prev => ({
      ...prev,
      [typeName]: newState
    }));
    
    // Directly sync with global context for sidebar
    setExpandedTypes(prev => ({
      ...prev,
      [typeName]: newState
    }));
    
    // If expanding (not collapsing), scroll to the section
    if (newState) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToExpandedType(typeName);
        });
      });
    }
  };
  
  // Function to scroll to expanded type
  const scrollToExpandedType = (typeName) => {
    const targetElement = typeRefs.current[typeName];
    const container = scrollContainerRef.current;
    
    if (!targetElement || !container) {
      console.warn(`Cannot scroll to ${typeName} - missing elements`);
      return;
    }

    // Get the target element's position relative to the container
    const containerRect = container.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    
    // Calculate the relative position
    const relativeTop = targetRect.top - containerRect.top;
    const currentScrollTop = container.scrollTop;
    
    // Calculate desired scroll position (target at 50px from top of container)
    const desiredScrollTop = currentScrollTop + relativeTop - 50;
    
    // Ensure we don't scroll past boundaries
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const finalScrollTop = Math.max(0, Math.min(desiredScrollTop, maxScrollTop));
    
    // Perform the scroll
    container.scrollTo({
      top: finalScrollTop,
      behavior: 'smooth'
    });
  };
  
  // Group properties by type
  const getPropertiesByType = () => {
    const grouped = {};
    allTemporalProperties.forEach(propertyId => {
      const type = propertyToTypeMap[propertyId] || 'Other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(propertyId);
    });
    
    // Sort types alphabetically to match sidebar order
    const sortedGrouped = Object.keys(grouped).sort().reduce((acc, key) => {
      acc[key] = grouped[key];
      return acc;
    }, {});
    
    return sortedGrouped;
  };
  
  // Get filtered properties based on search query
  const getFilteredPropertiesByType = () => {
    const propertiesByType = getPropertiesByType();
    
    if (!searchQuery.trim()) {
      return propertiesByType;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = {};
    
    Object.entries(propertiesByType).forEach(([type, propertyIds]) => {
      const matchingProperties = propertyIds.filter(propertyId => {
        const title = getPropertyTitle(propertyId).toLowerCase();
        return title.includes(query) || type.toLowerCase().includes(query);
      });
      
      if (matchingProperties.length > 0) {
        filtered[type] = matchingProperties;
      }
    });
    
    return filtered;
  };
  
  // Control panel functions
  const handleExpandAll = () => {
    const allTypes = Object.keys(getPropertiesByType());
    const newStates = {};
    allTypes.forEach(type => {
      newStates[type] = true;
    });
    setTypeStates(newStates);
    setExpandedTypes(newStates);
  };
  
  const handleCollapseAll = () => {
    const allTypes = Object.keys(getPropertiesByType());
    const newStates = {};
    allTypes.forEach(type => {
      newStates[type] = false;
    });
    setTypeStates(newStates);
    setExpandedTypes(newStates);
  };
  
  const handleJumpTo = (typeName) => {
    if (!typeName) return;
    
    // Expand the type if not already expanded
    setTypeStates(prev => ({
      ...prev,
      [typeName]: true
    }));
    setExpandedTypes(prev => ({
      ...prev,
      [typeName]: true
    }));
    
    // Scroll to it after a brief delay to ensure expansion
    setTimeout(() => {
      scrollToExpandedType(typeName);
    }, 100);
  };
  
  // Type Button Component (similar to PatternOverviewModal)
  const TypeButton = ({ typeName, open, onToggle }) => (
    <button
      onClick={onToggle}
      className="btn-reset flex items-center gap-2 w-full text-left select-none mb-4"
      style={{
        fontSize: 18,
        fontWeight: 600,
        background: "transparent",
        border: "none",
        padding: "8px 0",
        cursor: "pointer",
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {open ? "▾" : "▸"} 
      {typeToIcon[typeName] && (
        <span style={{ marginLeft: '8px', marginRight: '8px' }}>
          {typeToIcon[typeName]}
        </span>
      )}
      {typeName}
    </button>
  );
  
  // Header Button Component for control panel
  const HeaderButton = ({ onClick, disabled, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        background: disabled ? '#f9fafb' : '#fff',
        color: disabled ? '#9ca3af' : '#374151',
        fontSize: '13px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        ':hover': {
          background: disabled ? '#f9fafb' : '#f3f4f6'
        }
      }}
    >
      {children}
    </button>
  );
  
  if (!rawView) {
    return null;
  }
  
  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        backgroundColor: '#FFFFFF',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        Loading raw data graphs...
      </div>
    );
  }
  
  if (allTemporalProperties.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        backgroundColor: '#FFFFFF',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        No temporal properties found to display.
      </div>
    );
  }
  
  const propertiesByType = getPropertiesByType();
  const filteredPropertiesByType = getFilteredPropertiesByType();
  const sortedTypes = Object.keys(propertiesByType).sort();
  
  // Check if all types are expanded or collapsed
  const allOpen = sortedTypes.every(type => typeStates[type]);
  const allClosed = sortedTypes.every(type => !typeStates[type]);
  
  return (
    <div 
      className="main-content" style={{ 
      flex: 1, 
      width: '100%',
      height: 'calc(100vh - 40px)',
      backgroundColor: '#FFFFFF', // White background
      paddingBottom: 0,
      marginBottom: 0,
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
    }}>
      {/* Control Panel Toolbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: '#fffffff7',
          borderBottom: '1px solid #e5e7eb',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <HeaderButton onClick={handleExpandAll} disabled={allOpen}>
          Expand all
        </HeaderButton>
        <HeaderButton onClick={handleCollapseAll} disabled={allClosed}>
          Collapse all
        </HeaderButton>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#374151' }}>Jump to</label>
          <select
            onChange={(e) => handleJumpTo(e.target.value)}
            defaultValue=""
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: '13px',
            }}
          >
            <option value="" disabled>
              Choose type
            </option>
            {sortedTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            placeholder="Search property…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: 220,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      <main 
        ref={scrollContainerRef} // Move ref to the actual scrollable container
        className="graph-container" style={{
        padding: '16px 12px 10px 12px',
        backgroundColor: '#FFFFFF', // Match the container background
        marginTop: 0,
        marginBottom: 0,
        overflow: 'auto',
        minHeight: 0,
      }}>
        {/* No results message for search */}
        {Object.keys(filteredPropertiesByType).length === 0 && searchQuery.trim() && (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: '#6b7280',
              border: '1px dashed #e5e7eb',
              borderRadius: 12,
              background: '#fafafa',
            }}
          >
            No matches for "{searchQuery}".
          </div>
        )}

        {Object.entries(filteredPropertiesByType).map(([typeName, propertyIds]) => (
          <div 
            key={typeName} 
            ref={el => typeRefs.current[typeName] = el}
            style={{ 
              marginBottom: '20px',
              backgroundColor: '#F8F9FA', // Gray background for type sections
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid #E9ECEF',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}
          >
            {/* Type Header Button */}
            <TypeButton
              typeName={typeName}
              open={typeStates[typeName]}
              onToggle={() => handleToggleType(typeName)}
            />
            
            {/* Graphs for this type (only show if expanded) */}
            {typeStates[typeName] && (
              <div style={{ 
                marginLeft: '24px',
                marginTop: '12px',
                padding: '0px', 
                backgroundColor: 'transparent', 
                borderRadius: '0px',
                border: 'none'
              }}>
                {propertyIds.map((propertyId, index) => (
                  <div key={`raw-${propertyId}`} style={{ 
                    border: '1px solid #DEE2E6', 
                    borderRadius: '6px',
                    marginBottom: index === propertyIds.length - 1 ? '0px' : '12px',
                    marginLeft: '2px',
                    marginRight: '4px',
                    paddingRight: '16px',
                    paddingLeft: '16px',
                    backgroundColor: '#FFFFFF', 
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' 
                  }}>
                    <RawDataGraph
                      temporalPropertyIdToShow={propertyId}
                      graphId={`raw-graph-${propertyId}`}
                      DataUpdateService={DataUpdateService}
                      title={getPropertyTitle(propertyId)}
                      states={graphData[propertyId]?.states || []}
                      initialData={storedGraphData[propertyId] || []}
                      onVisibilityChange={() => handleGraphVisibility(propertyId)}
                      isVisible={typeStates[typeName]}
                      eventId={0} // Use event ID 0 (main) for raw data
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
};

export default RawDataView; 