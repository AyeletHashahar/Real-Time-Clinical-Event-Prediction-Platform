// // import React, { createContext, useState, useContext } from 'react';

// // const PatternContext = createContext();

// // export const usePatternContext = () => useContext(PatternContext);

// // export const PatternProvider = ({ children }) => {
// //   const [selectedPatternIndex, setSelectedPatternIndex] = useState(null);

// //   return (
// //     <PatternContext.Provider value={{ selectedPatternIndex, setSelectedPatternIndex }}>
// //       {children}
// //     </PatternContext.Provider>
// //   );
// // };


// import React, { createContext, useState, useContext } from 'react';
// import { useEventContext } from '../events/EventContext';

// const PatternContext = createContext();

// export const usePatternContext = () => useContext(PatternContext);

// export const PatternProvider = ({ children }) => {
//   const [selectedPatternIndex, setSelectedPatternIndexRaw] = useState(null);
//   const { setShowAllPatterns } = useEventContext();

//   // Wrap setSelectedPatternIndex to also handle showAllPatterns
//   const setSelectedPatternIndex = (index) => {
//     setSelectedPatternIndexRaw(index);
//     // When a specific pattern is selected, turn off show all patterns
//     if (index !== null) {
//       setShowAllPatterns(false);
//     }
//   };

//   return (
//     <PatternContext.Provider value={{ selectedPatternIndex, setSelectedPatternIndex }}>
//       {children}
//     </PatternContext.Provider>
//   );
// };

// export default PatternProvider;


import React, { createContext, useState, useContext, useEffect } from 'react';
import { useEventContext } from '../events/EventContext';

const PatternContext = createContext();

export const usePatternContext = () => useContext(PatternContext);

export const PatternProvider = ({ children }) => {
  const [selectedPatternIndex, setSelectedPatternIndexRaw] = useState(null);
  const { setShowAllPatterns, selectedEvent, MAIN_TAB_ID } = useEventContext();

  // Reset pattern selection when event changes
  useEffect(() => {
    if (selectedEvent === MAIN_TAB_ID) {
      setSelectedPatternIndexRaw(null);
      setShowAllPatterns(false);
    } else {
      setShowAllPatterns(true);
    }
  }, [selectedEvent, MAIN_TAB_ID, setShowAllPatterns]);

  // Listen for entity/model changes and reset pattern selection
  useEffect(() => {
    const handleEntityModelChange = () => {
      setSelectedPatternIndexRaw(null);
      setShowAllPatterns(false);
    };

    window.addEventListener('entity_model_changed', handleEntityModelChange);
    return () => {
      window.removeEventListener('entity_model_changed', handleEntityModelChange);
    };
  }, [setShowAllPatterns]);

  // Wrap setSelectedPatternIndex to also handle showAllPatterns
  const setSelectedPatternIndex = (index) => {
    setSelectedPatternIndexRaw(index);
    // When null, show all patterns, otherwise show only selected pattern
    setShowAllPatterns(index === null);
  };

  return (
    <PatternContext.Provider value={{ selectedPatternIndex, setSelectedPatternIndex }}>
      {children}
    </PatternContext.Provider>
  );
};

export default PatternProvider;