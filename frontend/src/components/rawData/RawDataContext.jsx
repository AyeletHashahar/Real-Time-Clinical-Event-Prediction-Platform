import { createContext, useContext, useState } from 'react';

const RawDataContext = createContext();
export const useRawData = () => useContext(RawDataContext);

export const RawDataProvider = ({ children }) => {
  const [rawView, setRawView] = useState(false);
  const [selectedRawDataType, setSelectedRawDataType] = useState(null);
  const [expandedTypes, setExpandedTypes] = useState({});
  const [scrollToType, setScrollToType] = useState(null);
  
  const showRawDataType = (typeName) => {
    setSelectedRawDataType(typeName);
    setRawView(true);
  };
  
  return (
    <RawDataContext.Provider value={{ 
      rawView, 
      setRawView, 
      selectedRawDataType, 
      setSelectedRawDataType, 
      showRawDataType,
      expandedTypes,
      setExpandedTypes,
      scrollToType,
      setScrollToType
    }}>
      {children}
    </RawDataContext.Provider>
  );
};
