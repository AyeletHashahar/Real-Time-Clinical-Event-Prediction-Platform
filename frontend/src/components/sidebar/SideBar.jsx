import { useState } from 'react';
import SideBarItems from './SideBarItems';
import { FaArrowRight, FaArrowLeft } from 'react-icons/fa6';

const SideBar = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div style={{
      width: isExpanded ? '210px' : '54px',
      transition: 'width 0.3s ease',
      backgroundColor:  ' #E9EEF6', //'#F7F7F7',
      height: '100vh',
      color: '#000',
      display: 'flex',
      flexDirection: 'column',
      padding: '10px 0',
      borderRight: '4px solid #FFFFFF', // '2px solid #E9EEF6'
      boxSizing: 'border-box',
      paddingRight: isExpanded ? '5px' : '0px',
    }}>
      {/* Move the arrow button to the top with no gap */}
      <button
        onClick={handleToggleSidebar}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          color: ' #484949',
          cursor: 'pointer',
          padding: '8px',
          marginTop: '0px',
          marginBottom: '0px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'flex-end' : 'center',
        }}
      >
        {isExpanded ? <FaArrowLeft /> : <FaArrowRight />}
      </button>

      {/* Sidebar items directly below the arrow button */}
      <div style={{ 
        marginTop: '10px',
        flex: 1,
        overflow: isExpanded ? 'auto' : 'visible',
        maxHeight: isExpanded ? 'calc(100vh - 20px)' : 'none', // Account for arrow button and padding
        paddingBottom: isExpanded ? '10px' : '0px',
        // Custom scrollbar styling for Firefox
        scrollbarWidth: 'thin',
        scrollbarColor: '#C1C1C1 #E9EEF6',
      }}>
        <SideBarItems isExpanded={isExpanded} onItemClick={handleToggleSidebar} />
      </div>
    </div>
  );
};

export default SideBar;
