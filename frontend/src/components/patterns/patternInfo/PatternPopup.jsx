import { useState, useEffect } from "react";
import { FaTimes, FaRegQuestionCircle } from "react-icons/fa";
import DataManagementService from "../../dataService/DataManagementService";
import PatternDetails from "./PatternDetails";

// Custom scrollbar styles (same as PatternOverviewModal)
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

export default function PatternModal({ patternId, eventId, triggerLabel }) {
  /* ─── state ──────────────────────────────────────────────────────────── */
  const [open, setOpen]        = useState(false);
  const [pattern, setPattern]  = useState(null);
  const [loading, setLoading]  = useState(false);
  const [err, setErr]          = useState(null);

  /* ─── reset pattern when patternId or eventId changes ───────────────── */
  useEffect(() => {
    setPattern(null);
    setErr(null);
  }, [patternId, eventId]);

  /* ─── fetch pattern once the modal is opened ─────────────────────────── */
  const handleOpen = async () => {
    setOpen(true);
    if (pattern) return;
    setLoading(true);
    setErr(null);
    try {
      const json = await DataManagementService.fetchPatternInfo(patternId, eventId);
      setPattern(json);
    } catch (e) {
      console.error(e);
      setErr("Failed to load pattern");
    } finally {
      setLoading(false);
    }
  };

  /* ─── UI ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <span
        onClick={handleOpen}
        className="pattern-trigger"
        style={{
          display: "inline-flex",
          alignItems: "center",
          marginTop: "0.8px",
          marginLeft: "3.8px",
          cursor: "pointer"
        }}
      >
        {triggerLabel ?? (
          <FaRegQuestionCircle
            style={{ fontSize: "1.0rem", color: "#ff4444" }}
          />
        )}
      </span>

      {/* modal */}
      {open && (
        <>
          {/* Inject custom scrollbar styles */}
          <style>{scrollbarStyles}</style>
          
          <div 
            className="modal-overlay"
            style={{
              background: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(8px)"
            }}
            onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
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
                  {pattern ? `Pattern ${pattern.pattern_id}` : 'Pattern Details'}
                </h2>

                <div style={{
                  width: "140px",
                  height: "2px",
                  background: "#6c86a7",
                  margin: "0 auto 20px auto",
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
                {loading && (
                  <div style={{
                    background: "rgba(0, 0, 0, 0.03)",
                    borderRadius: "16px",
                    padding: "24px",
                    margin: "0 auto",
                    maxWidth: "590px",
                    textAlign: "center"
                  }}>
                    <p style={{
                      fontSize: "18px",
                      margin: "0",
                      lineHeight: "1.6",
                      color: "#6c86a7"
                    }}>
                      Loading…
                    </p>
                  </div>
                )}
                
                {err && (
                  <div style={{
                    background: "rgba(220, 53, 69, 0.1)",
                    borderRadius: "16px",
                    padding: "24px",
                    margin: "0 auto",
                    maxWidth: "590px"
                  }}>
                    <p style={{
                      color: "#dc3545",
                      fontSize: "18px",
                      margin: "0",
                      lineHeight: "1.6"
                    }}>
                      {err}
                    </p>
                  </div>
                )}
                
                {pattern && (
                  <div style={{
                    background: "#FFFFFF",
                    borderRadius: '8px',
                    padding: '8px',
                    border: '1px solid #d0d0d0',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}>
                    <PatternDetails pattern={pattern}/>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
