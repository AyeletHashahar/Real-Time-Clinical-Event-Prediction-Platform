// src/research/ResearchModal.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FaArrowLeft } from "react-icons/fa";
import DataManagementService from '../dataService/DataManagementService';
import StaticRawDataLayout from './StaticRawDataLayout';
import StaticEventPatternsView from './StaticEventPatternsView';
import StaticPatternFocusPage from "./StaticPatternFocusPage";

/**
 * Full-screen research panel with a two-step flow:
 * Step 0: choose scope (raw / event)
 * Step 1: static mocks (raw snapshot OR event patterns/focus)
 */
export default function ResearchModal({ onClose, onSelection }) {
  // Steps: 0 = choose scope, 1 = content
  const [step, setStep] = useState(0);

  // Selection
  const [mode, setMode] = useState(null);            // 'raw' | 'event' | null
  const [events, setEvents] = useState([]);          // [{ id, name }]
  const [selectedEventId, setSelectedEventId] = useState(null);

  // Events loading state
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  // NEW: persist the chosen timestamp across pages
   const [investigateAtSec, setInvestigateAtSec] = useState(null);


  // Pattern focus (used in "event" mode, step 1)
  const [focusedPattern, setFocusedPattern] = useState(null);

  // “now” from server – used to cap UI sliders & as a fallback
  const serverNowRef = useRef(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Only fetch once per mount
      if (serverNowRef.current != null) return;

      try {
        const t = await DataManagementService.getCurrentTime(); // ideally a number
        if (!alive) return;

        const seconds =
          typeof t === "number"
            ? t
            : Number(t?.current_time ?? t?.time ?? t?.timestamp ?? t?.now);

        // write to the ref (NOT redeclare a const)
        serverNowRef.current = Number.isFinite(seconds)
          ? seconds
          : Math.floor(Date.now() / 1000); // fallback to client time
      } catch {
        if (!alive) return;
        serverNowRef.current = Math.floor(Date.now() / 1000); // fallback
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Reset focus whenever we leave event step
  useEffect(() => {
    if (step !== 1 || mode !== 'event') setFocusedPattern(null);
  }, [step, mode]);

  // Fetch events once (used for the "Specific event" option)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingEvents(true);
        setEventsError(null);
        const list = await DataManagementService.fetchAllEvents?.();
        if (!alive) return;
        if (Array.isArray(list)) setEvents(list);
      } catch (e) {
        if (!alive) return;
        setEventsError('Failed to load events');
        console.error(e);
      } finally {
        if (alive) setLoadingEvents(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stop = (e) => e.stopPropagation();

  const canStart = (() => {
    if (mode === 'raw') return true;
    if (mode === 'event') return selectedEventId != null;
    return false;
  })();

  // Header back arrow: go back one "page" in the flow
  const handleHeaderBack = () => {
    if (step !== 1) return;
    if (mode === 'event' && focusedPattern) {
      // From focus -> back to patterns list (still step 1)
      setFocusedPattern(null);
    } else {
      // From patterns list (event) OR raw snapshot -> back to selection (step 0)
      setStep(0);
    }
  };

  const handleStart = useCallback(() => {
    if (!canStart) return;
    const payload =
      mode === 'raw'
        ? { scope: 'raw', eventId: null }
        : { scope: 'event', eventId: selectedEventId };

    // Pass selection up (parent can store it for later)
    onSelection?.(payload);

    // Move to content step
    setStep(1);
  }, [canStart, mode, selectedEventId, onSelection]);

  // "now" from server (already stored in serverNowRef.current)
    // Use (now-1) as a safe default so the slider will show 0..(now-1)
    const maxSec = Math.max(0, (serverNowRef.current ?? 0) - 1);
    const effectiveTimeSec = investigateAtSec ?? maxSec;


  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div
        className="modal-content research-modal"
        onClick={stop}
        style={{
          // Fit inside the viewport (no clipping)
          width: 'min(1400px, 96vw)',
          height: 'min(940px, 92vh)',
          margin: 12,

          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.2)',

          // Header + scrollable body
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Header (sticky) */}
        <div style={{
          padding: '10px 16px',
          background: '#ffffffaa',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          backdropFilter: 'saturate(1.2) blur(2px)'
        }}>
          {/* Left: title + sub */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#222' }}>
              <span>Research</span>
            </span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {step === 0 ? 'Step 1: Choose scope' : (mode === 'raw' ? 'Raw Data' : 'Event Data')}
            </span>
          </div>

          {/* Right: Back (only on step 1) + Close (X) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step === 1 && (
              <button
                onClick={handleHeaderBack}
                aria-label="Back"
                title="Back"
                style={{
                  width: 36,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid #E5E7EB',
                  background: '#FFFFFF',
                  borderRadius: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  cursor: 'pointer'
                }}
              >
                <FaArrowLeft size={16} />
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close"
              title="Close"
              style={{
                width: 36,
                height: 36,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid #E5E7EB',
                background: '#FFFFFF',
                borderRadius: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div style={{ overflow: 'auto', padding: 16, minHeight: 0 }}>
          {step === 0 && (
            <div style={{
              maxWidth: 900,
              margin: '0 auto',
              display: 'grid',
              gap: 16,
              alignContent: 'start'
            }}>
              {/* Title */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#1f2937' }}>Choose your research target</h3>
                <p style={{ margin: '6px 0 0', color: '#4b5563', fontSize: 13 }}>
                  Pick exactly one option. Graphs will be shown only for the selected scope.
                </p>
              </div>

              {/* Cards — stacked & centered */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(300px, 560px)',
                  justifyContent: 'center',
                  gap: 12,
                  marginTop: 12
                }}
              >
                {/* Raw data card */}
                <label
                  htmlFor="mode-raw"
                  style={{
                    border: mode === 'raw' ? '2px solid #334155' : '1px solid #e5e7eb',
                    background: '#ffffff',
                    borderRadius: 12,
                    padding: 16,
                    cursor: 'pointer'
                  }}
                  onClick={() => setMode('raw')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      id="mode-raw"
                      type="radio"
                      name="research-mode"
                      checked={mode === 'raw'}
                      onChange={() => setMode('raw')}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#111827' }}>Raw data</div>
                      <div style={{ fontSize: 12, color: '#4b5563' }}>
                        Explore the unprocessed stream and baseline signals.
                      </div>
                    </div>
                  </div>
                </label>

                {/* Event-centric card */}
                <label
                  htmlFor="mode-event"
                  style={{
                    border: mode === 'event' ? '2px solid #334155' : '1px solid #e5e7eb',
                    background: '#ffffff',
                    borderRadius: 12,
                    padding: 16,
                    cursor: 'pointer'
                  }}
                  onClick={() => setMode('event')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      id="mode-event"
                      type="radio"
                      name="research-mode"
                      checked={mode === 'event'}
                      onChange={() => setMode('event')}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#111827' }}>Specific event</div>
                      <div style={{ fontSize: 12, color: '#4b5563' }}>
                        Focus the analysis on one event and its related patterns.
                      </div>

                      {/* Event selector appears only when "event" is chosen */}
                      {mode === 'event' && (
                        <div style={{ marginTop: 10 }}>
                          <label htmlFor="event-select" style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>
                            Select event
                          </label>
                          <select
                            id="event-select"
                            disabled={loadingEvents || !!eventsError}
                            value={selectedEventId ?? ''}
                            onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              background: '#fff'
                            }}
                          >
                            <option value="" disabled>
                              {loadingEvents ? 'Loading…' : eventsError ? 'Failed to load events' : 'Choose one event'}
                            </option>
                            {events.map((ev) => (
                              <option key={ev.id} value={ev.id}>
                                {ev.name ?? `Event ${ev.id}`}
                              </option>
                            ))}
                          </select>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                            Exactly one event can be selected.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>

              {/* Footer actions */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: canStart ? '#334155' : '#94a3b8',
                    color: '#fff',
                    cursor: canStart ? 'pointer' : 'not-allowed'
                  }}
                >
                  Start
                </button>
              </div>
            </div>
          )}

          {step === 1 && mode === 'raw' && (
            <StaticRawDataLayout
              title="Raw Data Snapshot"
              endTime={serverNowRef.current}   // cap by "now" for the raw snapshot
            />
          )}

          {step === 1 && mode === 'event' && !focusedPattern && (
            <StaticEventPatternsView
              eventIndex={selectedEventId}
              onOpenFocus={(p) => setFocusedPattern(p)}
              endTime={serverNowRef.current}   // slider max = time of entry
                timeSec={effectiveTimeSec}              // <<< controlled
                onChangeTime={setInvestigateAtSec}      // <<< controlled updater
            />
          )}

          {step === 1 && mode === 'event' && focusedPattern && (
            <StaticPatternFocusPage
              pattern={focusedPattern}
              // USE selected time from list (fallback to server time if missing):
              endTime={effectiveTimeSec}
            />
          )}
        </div>
      </div>
    </div>
  );
}
