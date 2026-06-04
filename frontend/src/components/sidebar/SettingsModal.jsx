import React, { useState, useEffect } from "react";
import StartDemoButton from "./StartDemoButton";
import DataService from "../dataService/DataManagementService";
import logoImage from "../../assets/logo_setting.png";

/**
 * SettingsModal – modern design matching the rest of the app
 */
export default function SettingsModal({ onClose }) {
  /* ---------------- state -------------------------------------------------- */
  const [entities,       setEntities]       = useState([]);   // [{id,name}]
  const [events,         setEvents]         = useState([]);   // [{id,name}]
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [isAppLoading,   setIsAppLoading]   = useState(false);

  /* ---------------- fetch entities + events once --------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await DataService.fetchEntitiesAndEvents();
        const ent = (res.entities ?? []).map((id) => ({ id, name: `Entity ${id}` }));
        const ev  = Object.entries(res.events ?? {})
                         .map(([id, name]) => ({ id: Number(id), name }));

        setEntities(ent);
        setEvents(ev);
        if (ent.length) setSelectedEntity(ent[0].id);
        if (ev.length)  setSelectedEvents(ev.map((e) => e.id));
      } catch (err) {
        console.error("Failed to load entities/events", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------- listen for app loaded event ---------------------------- */
  useEffect(() => {
    const handleAppLoaded = () => {
      setIsAppLoading(false);
      onClose();
    };

    // Listen for the fast_fetches_complete event which indicates initial fast-fetch phase is over
    window.addEventListener('fast_fetches_complete', handleAppLoaded);

    return () => {
      window.removeEventListener('fast_fetches_complete', handleAppLoaded);
    };
  }, [onClose]);

  /* ---------------- checkbox toggle --------------------------------------- */
  const toggleEvent = (id) => {
    setSelectedEvents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  /* ---------------- handle start demo with loading state ------------------ */
  const handleStartWithLoading = () => {
    setIsAppLoading(true);
  };

  /* ---------------- render loading screen ---------------------------------- */
  if (isAppLoading) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1100
      }}>
        <div style={{
          background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
          borderRadius: "16px",
          padding: "40px",
          width: "90%",
          maxWidth: "400px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          textAlign: "center",
          position: "relative"
        }}>
          {/* Decorative top border */}
          {/* <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "#6c86a7",
            borderRadius: "16px 16px 0 0"
          }} /> */}

          <div style={{
            border: "4px solid rgba(108, 134, 167, 0.1)",
            borderLeft: "4px solid #6c86a7",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            animation: "spin 1s linear infinite",
            margin: "0 auto 20px"
          }}></div>
          <div style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#2d3748",
            margin: "0"
          }}>
            Loading App...
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  /* ---------------- render main modal -------------------------------------- */
  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: "90vw",
          maxWidth: "500px",
          position: "relative",
          maxHeight: "90vh",
          background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
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

        {/* Fixed Header Section */}
        <div style={{
          padding: "20px 30px 0 30px", // Reduced from 30px to 20px
          flexShrink: 0,
          textAlign: "center"
        }}>
          {/* Logo */}
          <img 
            src={logoImage} 
            alt="LIOR logo" 
            style={{ 
              maxWidth: "160px", 
              height: "auto",
              marginBottom: "2px"
            }} 
          />

          <h2 style={{
            fontSize: "24px",
            margin: "0 0 12px 0", // Reduced from 16px to 12px
            fontWeight: "700",
            color: "#2d3748",
            letterSpacing: "0.5px"
          }}>
            Welcome to the LIOR System
          </h2>

          {/* <div style={{
            width: "140px",
            height: "2px",
            background: "#6c86a7",
            margin: "0 auto 20px auto",
            borderRadius: "2px"
          }} /> */}

          <p style={{
            fontSize: "16px",
            color: "#4a5568",
            lineHeight: "1.5",
            margin: "0 0 16px 0", // Reduced from 20px to 16px
            maxWidth: "400px",
            marginLeft: "auto",
            marginRight: "auto"
          }}>
            Select an entity and the events you're interested in, then press <strong>Start</strong>.
          </p>
        </div>

        {/* Scrollable Content Area */}
        <div style={{
          flex: 1,
          overflow: "auto",
          padding: "0 30px 20px 30px" // Reduced bottom padding from 30px to 20px
        }}>
          {loading ? (
            <div style={{
              background: "rgba(0, 0, 0, 0.03)",
              borderRadius: "16px",
              padding: "24px",
              textAlign: "center"
            }}>
              <p style={{
                fontSize: "18px",
                margin: "0",
                color: "#6c86a7"
              }}>
                Loading…
              </p>
            </div>
          ) : (
            <div style={{
              background: "#FFFFFF",
              borderRadius: "8px",
              padding: "20px", // Reduced from 24px to 20px
              border: "1px solid #d0d0d0",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
            }}>
              {/* Entity dropdown */}
              <div style={{ marginBottom: "20px" }}> {/* Reduced from 24px to 20px */}
                <label style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                  color: "#2d3748",
                  fontSize: "16px"
                }}>
                  Select Patient:
                </label>
                <select
                  value={selectedEntity ?? ""}
                  onChange={(e) => setSelectedEntity(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #d0d0d0",
                    background: "#fff",
                    color: "#2d3748",
                    fontSize: "14px",
                    fontWeight: "500",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    appearance: "none",
                    backgroundImage: "url(data:image/svg+xml;base64,PHN2ZyBmaWxsPSdub25lJyBzdHJva2U9JyM2Yzg2YTcnIHN0cm9rZS13aWR0aD0nMicgdmlld0JveD0nMCAwIDI0IDI0JyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxwb2x5bGluZSBwb2ludHM9JzYgOSAxMiAxNSAxOCA5Jy8+PC9zdmc+)",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    backgroundSize: "16px",
                    boxSizing: "border-box"
                  }}
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Events checklist */}
              <div>
                <label style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                  color: "#2d3748",
                  fontSize: "16px"
                }}>
                  Select Events:
                </label>
                <div style={{
                  border: "1px solid #d0d0d0",
                  borderRadius: "8px",
                  padding: "8px",
                  maxHeight: "200px", // Maximum height limit
                  height: events.length === 0 ? "60px" : "auto", // Dynamic height based on content
                  overflowY: events.length > 6 ? "auto" : "hidden", // Show scroll only when needed (roughly 6+ events)
                  background: "#fafafa"
                }}>
                  {events.map((ev) => {
                    const isSelected = selectedEvents.includes(ev.id);
                    return (
                      <div
                        key={ev.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          fontSize: "14px",
                          borderRadius: "6px",
                          transition: "background-color 0.2s ease",
                          margin: "1px 0",
                          backgroundColor: "transparent",
                          minHeight: "28px" // Ensure consistent item height for calculation
                        }}
                        onClick={() => toggleEvent(ev.id)}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(108, 134, 167, 0.1)"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <input
                          type="checkbox"
                          style={{ display: "none" }}
                          checked={isSelected}
                          onChange={() => toggleEvent(ev.id)}
                        />
                        <span
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "3px",
                            background: isSelected ? "#6c86a7" : "transparent",
                            border: "2px solid #6c86a7",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: "bold",
                            flexShrink: 0
                          }}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                        <span style={{ color: "#2d3748", fontWeight: "500" }}>
                          {ev.name || `Event ${ev.id}`}
                        </span>
                      </div>
                    );
                  })}
                  {events.length === 0 && (
                    <p style={{
                      fontSize: "14px",
                      color: "#6c86a7",
                      textAlign: "center",
                      margin: "0",
                      padding: "8px" // Reduced from 12px to 8px
                    }}>
                      No events available
                    </p>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div style={{
                display: "flex",
                justifyContent: "center",
                gap: "6px",
                marginTop: "0px"
              }}>
                <StartDemoButton
                  selectedEntity={selectedEntity}
                  selectedEvents={selectedEvents}
                  onStartSuccess={() => setIsAppLoading(true)}
                  className="close-button mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                  style={{fontSize: '16px', marginTop: "20px", borderRadius: "8px"}} // Reduced from 28px to 20px
                />
                <button 
                  onClick={onClose}
                  className="close-button mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                  style={{fontSize: '16px', marginTop: "20px", borderRadius: "8px"}} // Reduced from 28px to 20px
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
