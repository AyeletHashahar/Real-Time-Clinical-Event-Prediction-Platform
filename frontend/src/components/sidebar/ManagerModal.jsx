/* ------------------------------------------------------------------------
   ManagerModal.jsx – password gate ➊, admin panel ➋
   ------------------------------------------------------------------------ */
import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import DataManagementService from "../dataService/DataManagementService";

export default function ManagerModal({ onClose }) {
  /* ➊ password layer */
  const [pwd, setPwd]             = useState("");
  const [unlocked, setUnlocked]   = useState(false);
  const [err, setErr]             = useState(null);

  /* ➋ admin layer */
  const [eventName, setEventName]       = useState("");
  const [patternName, setPatternName]   = useState("");
  const [file, setFile]                 = useState(null);
  const [msg, setMsg]                   = useState(null);

  // very naive demo-check – replace with real auth call
  const tryUnlock = () => {
    if (pwd === "1234") {   // or hard-coded "1234" for PoC
      setUnlocked(true);
      setErr(null);
    } else {
      setErr("Wrong password");
    }
  };

  /* save names */
  const handleSaveNames = async () => {
    try {
      await DataManagementService.adminRename({ eventName, patternName });
      setMsg("Names updated");
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  /* file upload */
  const handleUpload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      await DataManagementService.adminUpload(form);
      setMsg("File uploaded");
    } catch (e) {
      setMsg("Upload failed: " + e.message);
    }
  };

  return (
    <div 
      className="modal-overlay"
      style={{
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)"
      }}
      onClick={onClose}
    >
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
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

        {/* Close button */}
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
          flexShrink: 0,
          textAlign: "center"
        }}>
          <h2 style={{
            fontSize: "28px",
            margin: "0 0 8px 0",
            fontWeight: "700",
            color: "#2d3748",
            letterSpacing: "0.5px"
          }}>
            {!unlocked ? "Manager Login" : "Admin Panel"}
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
        <div style={{
          flex: 1,
          overflow: "auto",
          padding: "0 30px 30px 30px"
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: "8px",
            padding: "24px",
            border: "1px solid #d0d0d0",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
          }}>
            {/* ➊ password gate */}
            {!unlocked && (
              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontSize: "16px",
                  color: "#4a5568",
                  marginBottom: "20px",
                  lineHeight: "1.5"
                }}>
                  Enter the manager password to access admin functions.
                </p>
                
                <input
                  type="password"
                  placeholder="Password"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #d0d0d0",
                    background: "#fff",
                    color: "#2d3748",
                    fontSize: "16px",
                    marginBottom: "12px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && tryUnlock()}
                />
                
                {err && (
                  <div style={{
                    background: "rgba(220, 53, 69, 0.1)",
                    borderRadius: "8px",
                    padding: "12px",
                    marginBottom: "16px"
                  }}>
                    <p style={{
                      color: "#dc3545",
                      fontSize: "14px",
                      margin: "0"
                    }}>
                      {err}
                    </p>
                  </div>
                )}
                
                <button 
                  onClick={tryUnlock}
                  className="close-button mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                  style={{
                    fontSize: '16px',
                    borderRadius: "8px",
                    width: "100%"
                  }}
                >
                  Enter
                </button>
              </div>
            )}

            {/* ➋ admin panel – shown only after unlock */}
            {unlocked && (
              <div>
                {/* Rename section */}
                <div style={{ marginBottom: "24px" }}>
                  <h3 style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#2d3748",
                    marginBottom: "16px"
                  }}>
                    Rename Components
                  </h3>
                  
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "500",
                      color: "#2d3748",
                      fontSize: "14px"
                    }}>
                      Event Name:
                    </label>
                    <input 
                      value={eventName} 
                      onChange={e => setEventName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d0d0d0",
                        background: "#fff",
                        color: "#2d3748",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "500",
                      color: "#2d3748",
                      fontSize: "14px"
                    }}>
                      Pattern Name:
                    </label>
                    <input 
                      value={patternName} 
                      onChange={e => setPatternName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d0d0d0",
                        background: "#fff",
                        color: "#2d3748",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  
                  <button 
                    onClick={handleSaveNames}
                    className="close-button mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                    style={{
                      fontSize: '14px',
                      borderRadius: "6px",
                      marginTop: "8px"
                    }}
                  >
                    Save Names
                  </button>
                </div>

                {/* Divider */}
                <div style={{
                  height: "1px",
                  background: "#e2e8f0",
                  margin: "24px 0"
                }} />

                {/* Upload section */}
                <div>
                  <h3 style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#2d3748",
                    marginBottom: "16px"
                  }}>
                    File Upload
                  </h3>
                  
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "500",
                      color: "#2d3748",
                      fontSize: "14px"
                    }}>
                      Select File:
                    </label>
                    <input 
                      type="file" 
                      onChange={e => setFile(e.target.files[0])}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d0d0d0",
                        background: "#fff",
                        color: "#2d3748",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  
                  <button 
                    onClick={handleUpload} 
                    disabled={!file}
                    className="close-button mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                    style={{
                      fontSize: '14px',
                      borderRadius: "6px",
                      marginTop: "8px",
                      opacity: !file ? 0.5 : 1,
                      cursor: !file ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Upload
                  </button>
                </div>

                {/* Message display */}
                {msg && (
                  <div style={{
                    background: msg.includes("Error") ? "rgba(220, 53, 69, 0.1)" : "rgba(34, 197, 94, 0.1)",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: "16px"
                  }}>
                    <p style={{
                      color: msg.includes("Error") ? "#dc3545" : "#16a34a",
                      fontSize: "14px",
                      margin: "0"
                    }}>
                      {msg}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
