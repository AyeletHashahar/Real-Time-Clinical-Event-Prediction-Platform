// src/components/modals/StarInfoModal.jsx
import React, { useState, useEffect } from "react";
import lior_about from "../../assets/LIOR_about.png";

export default function LiorInfoModal({ open, onClose }) {
  const [needsScrolling, setNeedsScrolling] = useState(false);

  useEffect(() => {
    if (open) {
      // Check if scrolling is needed after render
      const timer = setTimeout(() => {
        const modal = document.querySelector('.modal-content.pattern-modal');
        if (modal) {
          const isScrolling = modal.scrollHeight > modal.clientHeight;
          setNeedsScrolling(isScrolling);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;   // modal hidden

  // Dynamic sizing based on screen width and scrolling needs
  const getResponsiveStyles = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Base styles for different screen sizes
    let baseStyles;
    if (width < 480) { // Mobile
      baseStyles = {
        imageHeight: "180px",
        titleSize: "24px",
        quoteSize: "16px",
        textSize: "14px",
        dateSize: "14px",
        modalPadding: "20px 20px",
        containerMaxWidth: "95vw",
        textPadding: "16px"
      };
    } else if (width < 768) { // Tablet
      baseStyles = {
        imageHeight: "220px",
        titleSize: "28px",
        quoteSize: "18px",
        textSize: "16px",
        dateSize: "15px",
        modalPadding: "25px 25px",
        containerMaxWidth: "90vw",
        textPadding: "20px"
      };
    } else { // Desktop
      baseStyles = {
        imageHeight: "280px",
        titleSize: "36px",
        quoteSize: "22px",
        textSize: "18px",
        dateSize: "16px",
        modalPadding: "30px 30px",
        containerMaxWidth: "650px",
        textPadding: "24px"
      };
    }

    // Check if we need aggressive sizing (when modal height > 90% of screen height)
    const modalHeight = height * 0.9;
    const estimatedContentHeight = 
      parseInt(baseStyles.imageHeight) + // Image
      parseInt(baseStyles.titleSize) * 2 + // Title + margin
      parseInt(baseStyles.dateSize) * 2 + // Date + margin  
      parseInt(baseStyles.quoteSize) * 3 + // Quote (3 lines)
      parseInt(baseStyles.textSize) * 6 + // Text content (6 lines)
      parseInt(baseStyles.textPadding) * 2 + // Text container padding
      100; // Additional margins and padding

    const needsCompression = estimatedContentHeight > modalHeight;

    if (needsCompression) {
      // Reduce all fonts by 2 and shrink image
      return {
        imageHeight: `${parseInt(baseStyles.imageHeight) * 0.7}px`, // 30% smaller
        titleSize: `${parseInt(baseStyles.titleSize) - 2}px`,
        quoteSize: `${parseInt(baseStyles.quoteSize) - 2}px`,
        textSize: `${parseInt(baseStyles.textSize) - 2}px`,
        dateSize: `${parseInt(baseStyles.dateSize) - 2}px`,
        modalPadding: baseStyles.modalPadding,
        containerMaxWidth: baseStyles.containerMaxWidth,
        textPadding: `${parseInt(baseStyles.textPadding) * 0.8}px` // Reduce padding too
      };
    }

    return baseStyles;
  };

  const styles = getResponsiveStyles();

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
                width: "95vw",
                maxWidth: styles.containerMaxWidth,
                position: "relative",
                maxHeight: "90vh",
                background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                borderRadius: "24px",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                padding: styles.modalPadding,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                overflow: "hidden" // Prevent scrolling, content should fit
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
                borderRadius: "24px 24px 0 0"
            }} /> */}

            <img
                src={lior_about}
                alt="LIOR"
                style={{
                    height: styles.imageHeight, 
                    width: "auto", 
                    userSelect: "none",
                    borderRadius: "16px",
                    marginBottom: "20px",
                    filter: "drop-shadow(0 8px 24px rgba(0, 0, 0, 0.15))",
                    maxWidth: "85%"
                }}
                draggable="false"
            />

            <div style={{
                maxWidth: "100%", 
                margin: "0 auto",
                textAlign: "center",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
            }}>
                <h2 style={{
                    fontSize: styles.titleSize, 
                    margin: "0 0 6px 0", 
                    fontWeight: "700", 
                    color: "#2d3748",
                    letterSpacing: "0.5px"
                }}>
                    Lior Tkach
                </h2>
                
                <div style={{
                    fontSize: styles.dateSize, 
                    margin: "0 0 12px 0", 
                    color: "#6c86a7",
                    fontWeight: "500",
                    letterSpacing: "1px"
                }}>
                    02/01/97 - 07/10/2023
                </div>
                
                <div style={{
                    width: "100px",
                    height: "2px",
                    background: "#6c86a7",
                    margin: "0 auto 12px auto",
                    borderRadius: "2px"
                }} />
                
                <p style={{
                    fontSize: styles.quoteSize, 
                    margin: "0 0 12px 0", 
                    color: "#4a5568",
                    lineHeight: "1.4",
                    fontStyle: "italic",
                    fontWeight: "400",
                    padding: "0 10px"
                }}>
                    "Sometimes someone departs from this world,
                    <br />
                    yet the light they leave behind only grows and spreads"
                </p>
                
                <div style={{
                    background: "rgba(0, 0, 0, 0.03)",
                    borderRadius: "16px",
                    padding: styles.textPadding,
                    margin: "0 auto",
                    maxWidth: "100%"
                }}>
                    <p style={{
                        fontSize: styles.textSize, 
                        margin: "0 0 8px 0", 
                        lineHeight: "1.5", 
                        color: "#2d3748",
                        fontWeight: "400"
                    }}>
                        Lior Tkach, may his memory be blessed, was one such soul. 
                        <br />
                        A man of joy, of love and of music.
                    </p>
                    
                    <p style={{
                        fontSize: styles.textSize, 
                        margin: "0", 
                        lineHeight: "1.5", 
                        color: "#2d3748",
                        fontWeight: "400"
                    }}>
                        He was tragically murdered on October 7th 2023, 
                        while celebrating life at the Nova Music Festival. The void he left is irreplaceable, 
                        yet his spirit continues to inspire all who knew him.
                    </p>
                </div>
            </div>

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
            }}
             title="Close"
             aria-label="Close"
            >
                      &times;
            </button>
        </div>
    </div>
  );
}
