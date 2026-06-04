import React from 'react';
import { FaUser } from 'react-icons/fa6'; // Import user icon

const PatientInfoModal = ({ patientData, error, onClose }) => {
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
            className="modal-content pattern-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
                width: "85vw",
                height: "80vh",
                maxWidth: "500px",
                maxHeight: "550px",
                position: "relative",
                minHeight: "55vh",
                background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                borderRadius: "16px",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                padding: "30px 30px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
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
                background: "#6c86a7"
            }} /> */}

            {/* User Icon */}
            <div className="icon-container" style={{ marginBottom: "10px", marginTop: "14px" }}>
                <FaUser className="user-icon" style={{ fontSize: "64px", color: "rgba(0, 0, 0, 0.25" }} /> 
            </div>

            <h2 style={{
                fontSize: '28px', 
                margin: "0 0 8px 0", 
                fontWeight: "700", 
                color: "#2d3748",
                letterSpacing: "0.5px"
            }}>
                Patient Information
            </h2>

            <div style={{
                width: "140px",
                height: "2px",
                background: "#6c86a7",
                margin: "0 auto 12px auto",
                borderRadius: "2px"
            }} />

            {error ? (
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
                        {error}
                    </p>
                </div>
            ) : patientData ? (
                <div style={{
                    background: "rgba(0, 0, 0, 0.03)",
                    borderRadius: "16px",
                    padding: "24px",
                    margin: "0 auto",
                    width: "100%",
                    maxWidth: "590px"
                }}>
                    <div style={{fontSize: '18px', lineHeight: "1.6", color: "#2d3748", textAlign: "left"}}>
                        <p style={{ margin: "0 0 10px 0" }}><strong>Entity ID:</strong> {patientData.EntityID || "N/A"}</p>
                        <p style={{ margin: "0 0 10px 0" }}><strong>Gender:</strong> {patientData.gender || "N/A"}</p>
                        <p style={{ margin: "0 0 10px 0" }}><strong>Age:</strong> {patientData.age ? Math.round(patientData.age) : "N/A"}</p>
                        <p style={{ margin: "0 0 10px 0" }}><strong>Admission type:</strong> {patientData.admission_type || "N/A"}</p>
                        <p style={{ margin: "0 0 10px 0" }}><strong>Ethnicity:</strong> {patientData.ethnicity || "N/A"}</p>
                        <p style={{ margin: "0" }}><strong>Length of Stay:</strong> {patientData.los ? patientData.los.toFixed(2) + " days" : "N/A"}</p>
                    </div>
                </div>
            ) : (
                <div style={{
                    background: "rgba(0, 0, 0, 0.03)",
                    borderRadius: "16px",
                    padding: "24px",
                    margin: "0 auto",
                    maxWidth: "590px"
                }}>
                    <p style={{
                        fontSize: "18px",
                        margin: "0",
                        lineHeight: "1.6",
                        color: "#6c86a7"
                    }}>
                        Loading...
                    </p>
                </div>
            )}

            <button className="close-button mx-auto mt-4 px-4 py-2 bg-blue-600 text-white rounded" style={{fontSize: '16px', marginTop: "28px", borderRadius: "8px"}}
                onClick={onClose}>Close</button>
            {/* <button 
                style={{
                    marginTop: "32px",
                    padding: "12px 32px",
                    background: "#6c86a7",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "18px",
                    fontWeight: "normal",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease"
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = "#5a7490"}
                onMouseOut={(e) => e.target.style.backgroundColor = "#6c86a7"}
                onClick={onClose}
            >
                Close
            </button> */}
        </div>
    </div>
  );
};

export default PatientInfoModal;
