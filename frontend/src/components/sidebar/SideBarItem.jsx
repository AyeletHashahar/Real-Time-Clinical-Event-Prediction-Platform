// const SideBarItem = ({ icon, label, isExpanded }) => {
//   return (
//     <div 
//       style={{ 
//         display: 'flex', 
//         alignItems: 'center',  // Vertically center both icon and text
//         height: '50px',  // Fix the height for consistent layout
//         padding: '10px', 
//         transition: 'all 0.3s ease',  // Smooth transition for hover effect
//         borderRadius: '4px',  // Slightly rounded edges
//         cursor: 'pointer',  // Change cursor to pointer to indicate hoverable item
//         margin: '5px 0',  // Add some spacing between items
//       }}
//       className="sidebar-item"
//     >
//       <div 
//         style={{ 
//           width: '40px',  // Fixed width for the icon container
//           height: '40px', // Fixed height to keep consistent size
//           fontSize: '24px',
//           display: 'flex', 
//           alignItems: 'center', 
//           justifyContent: 'center', 
//           flexShrink: 0,  // Prevent shrinking
//         }}
//       >
//         {icon}
//       </div>
//       {/* Add smooth transition for text to prevent jumping */}
//       <span 
//         style={{
//           marginLeft: isExpanded ? '10px' : '0', 
//           opacity: isExpanded ? 1 : 0,  // Fade in/out effect
//           transition: 'opacity 0.3s ease, margin-left 0.3s ease',  // Smooth transition
//           whiteSpace: 'nowrap',  // Prevent text wrapping
//         }}
//       >
//         {label}
//       </span>
//     </div>
//   );
// };

// export default SideBarItem;

import React from 'react';

const SideBarItem = ({ icon, label, isExpanded }) => {
  // Clone the icon and change its color
  const iconWithUpdatedColor = React.cloneElement(icon, {
    style: {
      ...icon.props.style,
      color: icon.props.style?.color || ' #484949'  // Use existing color if specified or default to #484949
    }
  });

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center',
        height: '35px',  // Reduced height
        padding: '8px', 
        transition: 'all 0.3s ease',
        borderRadius: '22px',
        cursor: 'pointer',
        margin: '4px 0',  // Reduced margin
      }}
      className="sidebar-item"
    >
      <div 
        style={{ 
          width: '31px',  // Reduced width
          height: '31px', // Reduced height
          fontSize: '22px', // Smaller icon size
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexShrink: 0,
        }}
      >
        {iconWithUpdatedColor}
      </div>
      <span 
        style={{
          marginLeft: isExpanded ? '8px' : '0', 
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 0.3s ease, margin-left 0.3s ease',
          whiteSpace: 'nowrap',
          fontSize: '14px', // Smaller font size
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default SideBarItem;