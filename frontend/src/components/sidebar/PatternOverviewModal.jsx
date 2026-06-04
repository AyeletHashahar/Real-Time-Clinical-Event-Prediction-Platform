/* ------------------------------------------------------------------------
   PatternOverviewModal.jsx
   ------------------------------------------------------------------------ */
   import PatternDetails from "../patterns/patternInfo/PatternDetails";
   import { FaTimes, FaChevronDown, FaChevronRight } from "react-icons/fa";
   import { useState, useMemo } from "react";

   // Custom scrollbar styles
   const scrollbarStyles = `
     .custom-scrollbar::-webkit-scrollbar {
       width: 10px;
     }
     
     .custom-scrollbar::-webkit-scrollbar-track {
       background: rgba(0, 0, 0, 0.00);
       border-radius: 30px;
     }
     
     .custom-scrollbar::-webkit-scrollbar-thumb {
       background: #6c86a7;
       border-radius: 30px;
     }
     
     .custom-scrollbar::-webkit-scrollbar-thumb:hover {
       background: #5a7490;
       border-radius: 30px;
     }

     /* Firefox */
     .custom-scrollbar {
       scrollbar-width: thin;
       scrollbar-color: #7F7F7F rgba(0, 0, 0, 0.03);
     }
   `;
   
   /* Event Button Component (similar to TypeButton in RawDataView) */
   const EventButton = ({ eventId, eventName, patternCount, open, onToggle }) => (
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
       <span style={{ marginLeft: '8px' }}>
         {eventName ? `${eventName}` : ''}
       </span>
     </button>
   );
   
   /* Pattern Button Component */
   const PatternButton = ({ id, open, onToggle }) => (
     <button
       onClick={onToggle}
       className="btn-reset flex items-center gap-2 w-full text-left select-none"
       style={{
         fontSize: 16,
         fontWeight: 500,
         background: "transparent",
         border: "none",
         padding: "4px 0",
         cursor: "pointer",
         marginBottom: "8px"
       }}
     >
       {open ? "▾" : "▸"} Pattern {id}
     </button>
   );
   
   
   export default function PatternOverviewModal({ patterns=[], error, onClose }) {
     if (!patterns.length && !error) return null;
   
       const byEvent = useMemo(() => {
         const m = {};
         patterns.forEach((p) => (m[p.event_id] = [...(m[p.event_id] || []), p]));
         return m;
       }, [patterns]);

       const [openEvents, setOpenEvents] = useState({});
       const [openPatterns, setOpenPatterns] = useState({});
   
     /*   dynamic title */
     const title = `Patterns Overview`;
   
     return (
       <>
         {/* Inject custom scrollbar styles */}
         <style>{scrollbarStyles}</style>
         
         <div 
           className="modal-overlay"
           style={{
             background: "rgba(0, 0, 0, 0.8)",
             backdropFilter: "blur(8px)"
           }}
           onClick={onClose}
         >
             <div
               className="modal-content pattern-modal"
               onClick={(e) => e.stopPropagation()}
               style={{
                 width: "70vw",
                 height: "80vh",
                 maxWidth: "none",
                 minHeight: "none",
                 maxHeight: "none",
                 position: "relative",
                 background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                 borderRadius: "16px",
                 boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                 border: "1px solid rgba(255, 255, 255, 0.2)",
                 display: "flex",
                 flexDirection: "column",
                 overflow: "hidden"
               }}
             >
               {/* Decorative top border
               <div style={{
                 position: "absolute",
                 top: 0,
                 left: 0,
                 right: 0,
                 height: "4px",
                 background: "#6c86a7",
                 borderRadius: "16px 16px 0 0"
               }} /> */}

               {/* close button */}
               <button
                 onClick={onClose}
                 style={{
                   position: "absolute",
                   top: "12px",
                   right: "12px",
                   background: "transparent",
                   border: "none",
                   fontSize: "26px",
                   lineHeight: 1,
                   cursor: "pointer",
                   zIndex: 10
                 }}
                 title="Close"
                 aria-label="Close"
               >
                 &times;
               </button>

               {/* Fixed Header Section */}
               <div style={{
                 padding: "30px 30px 0 30px",
                 flexShrink: 0
               }}>
                 <h2 style={{ 
                   fontSize: '32px', 
                   margin: "0 0 8px 0", 
                   fontWeight: "700", 
                   color: "#2d3748",
                   letterSpacing: "0.5px",
                   textAlign: "center"
                 }}>
                   {title}
                 </h2>

                 <div style={{
                   fontSize: "16px", 
                   margin: "0 0 16px 0", 
                   color: "#6c86a7",
                   fontWeight: "500",
                   letterSpacing: "1px",
                   textAlign: "center"
                 }}>
                  {[...new Set(patterns.map(p => p.event_id))].length} Events  // {patterns.length} Patterns 
                 </div>

                 <div style={{
                   width: "140px",
                   height: "2px",
                   background: "#6c86a7",
                   margin: "0 auto 18px auto",
                   borderRadius: "2px"
                 }} />
               </div>

               {/* Scrollable Content Area */}
               <div 
                 className="custom-scrollbar"
                 style={{
                   flex: 1,
                   overflow: "auto",
                   padding: "0 30px 20px 30px",
                   margin: "0 0 8px 8px",
                   borderRadius: "16px"
                 }}
               >
                 {/* Error message */}
                 {error && (
                   <div style={{
                     background: "rgba(220, 53, 69, 0.1)",
                     borderRadius: "16px",
                     padding: "24px",
                     margin: "0 auto 24px auto",
                     maxWidth: "590px"
                   }}>
                     <p style={{
                       color: "#dc3545",
                       fontSize: "18px",
                       margin: "0",
                       lineHeight: "1.6"
                     }}>
                       {error}
                     </p>
                   </div>
                 )}

                 {/* Events content */}
                 {!error && Object.entries(byEvent).map(([eventId, pattArr]) => (
                   <div key={eventId} style={{ 
                     marginBottom: '20px',
                     backgroundColor: '#FFFFFF', //#FbFbFA
                     borderRadius: '8px',
                     padding: '16px',
                     border: '1px solid #d0d0d0',
                     boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                   }}>
                     {/* Event Header Button */}
                     <EventButton
                       eventId={eventId}
                       eventName={pattArr[0]?.event?.name}
                       patternCount={pattArr.length}
                       open={openEvents[eventId]}
                       onToggle={() =>
                         setOpenEvents((s) => ({ ...s, [eventId]: !s[eventId] }))
                       }
                     />

                     {/* Patterns for this event (only show if expanded) */}
                     {openEvents[eventId] && (
                       <div style={{ 
                         marginLeft: '0px',
                         marginTop: '12px'
                       }}>
                         {pattArr.map((pat, index) => (
                           <div key={pat.pattern_id} style={{
                             border: '1px solid #DEE2E6',
                             borderRadius: '6px',
                             marginBottom: index === pattArr.length - 1 ? '0px' : '16px',
                             padding: '16px',
                             backgroundColor: '#FFFFFF',
                             boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                           }}>
                             <PatternButton
                               id={pat.pattern_id}
                               open={openPatterns[pat.pattern_id]}
                               onToggle={() =>
                                 setOpenPatterns((s) => ({
                                   ...s,
                                   [pat.pattern_id]: !s[pat.pattern_id],
                                 }))
                               }
                             />

                             {/* Pattern content */}
                             {openPatterns[pat.pattern_id] && (
                               <div style={{ 
                                 marginLeft: '0px', 
                                 marginTop: '12px',
                                 paddingTop: '12px',
                                 borderTop: '1px solid #E9ECEF'
                               }}>
                                 <PatternDetails pattern={pat} />
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
           </div>
         </div>
       </>
     );
   
   }
   