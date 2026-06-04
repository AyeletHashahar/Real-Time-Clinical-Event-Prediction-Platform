// UserStudyModal.jsx
import { useEffect, useState } from "react";
import DataManagementService from "../dataService/DataManagementService"; // ← adjust path if needed

/** ===== Password & storage keys ===== */
const USER_STUDY_PASSWORD = "1234";
const RENDERER_KEY = "graphRenderer";            // "uniform" | "overlay" | "legacy"
const RIGHT_EDGE_AIDS_KEY = "showRightEdgeAids"; // "on" | "off"

/** Read current session_id */
const getSessionId = () =>
  sessionStorage.getItem("session_id") || localStorage.getItem("session_id");

export default function UserStudyModal({ onClose }) {
  const [pwd, setPwd] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState(null);

  // UI options
  const [selectedRenderer, setSelectedRenderer] = useState("legacy");
  const [rightEdgeAids, setRightEdgeAids] = useState("on");

  // Datasets (no entities)
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const currentRenderer = sessionStorage.getItem(RENDERER_KEY) || "legacy";
    const currentAids = sessionStorage.getItem(RIGHT_EDGE_AIDS_KEY) || "on";
    setSelectedRenderer(currentRenderer);
    setRightEdgeAids(currentAids);
  }, []);

  const tryUnlock = async () => {
    if (pwd !== USER_STUDY_PASSWORD) {
      setErr("Wrong password");
      return;
    }
    setErr(null);
    setUnlocked(true);
    await fetchDatasets();
  };

  /** Load datasets list via the central service */
  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const list = await DataManagementService.fetchDatasetNames(); // GET /fetch_dataset_names
      setDatasets(list);
      const current = sessionStorage.getItem("dataset_name");
      setSelectedDataset(current && list.includes(current) ? current : list[0] || "");
    } catch (e) {
      console.error("Failed to fetch datasets via service:", e);
      const list = ["Falls", "LCOS_onset"]; // fallback so UI stays usable
      setDatasets(list);
      const current = sessionStorage.getItem("dataset_name");
      setSelectedDataset(current && list.includes(current) ? current : list[0]);
    } finally {
      setLoadingDatasets(false);
    }
  };

  /** Apply choices and reset session/data on server via the service */
  const saveAndRestart = async () => {
    const sid = getSessionId();
    if (!sid) {
      alert("Missing session_id. Please start a session first.");
      return;
    }
    if (!selectedDataset) {
      alert("Please choose a dataset.");
      return;
    }

    setSaving(true);
    try {
      // persist UI toggles for this session
      sessionStorage.setItem(RENDERER_KEY, selectedRenderer);
      sessionStorage.setItem(RIGHT_EDGE_AIDS_KEY, rightEdgeAids);
      sessionStorage.setItem("dataset_name", selectedDataset);

      // switch dataset THROUGH DataManagementService (POST /reset_session?...):
      await DataManagementService.switchDataset(selectedDataset);

      // hard reload so everything mounts with the new data/config
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert(`Failed to switch dataset: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "92vw",
          maxWidth: 760,
          margin: "6vh auto",
          background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.2)",
          overflow: "hidden",
          position: "relative",
          maxHeight: "86vh",
          overflowY: "auto",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            fontSize: 26,
            lineHeight: 1,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          &times;
        </button>

        {/* Header */}
        <div style={{ padding: "28px 28px 0 28px", textAlign: "center" }}>
          <h2
            style={{
              fontSize: 24,
              margin: "0 0 8px 0",
              fontWeight: 700,
              color: "#2d3748",
              letterSpacing: "0.4px",
            }}
          >
            User Study
          </h2>
          <div
            style={{
              width: 120,
              height: 2,
              background: "#6c86a7",
              margin: "0 auto 18px auto",
              borderRadius: 2,
            }}
          />
        </div>

        {/* Body */}
        <div style={{ padding: "0 28px 28px 28px" }}>
          {!unlocked ? (
            <LoginCard pwd={pwd} setPwd={setPwd} err={err} tryUnlock={tryUnlock} />
          ) : (
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #d0d0d0",
                padding: 20,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              {/* Renderer choice */}
              <SectionTitle text="Variable Graph - Intervals Display" />
              {/* <OptionCard
                id="uniform"
                groupName="renderer"
                title="UniformIntervalsChart"
                description="Uniform bin height; raw points projected into scaled axis."
                selected={selectedRenderer === "uniform"}
                onSelect={() => setSelectedRenderer("uniform")}
              /> */}
              <OptionCard
                id="toggle"
                groupName="renderer"
                title="Toggle"
                description="Uniform intervals height on the y-axis, and the raw data is viewed separately."
                selected={selectedRenderer === "legacy"}
                onSelect={() => setSelectedRenderer("legacy")}
              />
              <OptionCard
                id="overlay"
                groupName="renderer"
                title="Overlay"
                description="Proportional-height bins with raw data overlay."
                selected={selectedRenderer === "overlay"}
                onSelect={() => setSelectedRenderer("overlay")}
              />

              {/* Aids toggle */}
              <SectionTitle text="Main Event Graph - Box Indicator" />
              <OptionCard
                id="aids-on"
                groupName="aids"
                title="Show"
                description="Show box indicator"
                selected={rightEdgeAids === "on"}
                onSelect={() => setRightEdgeAids("on")}
              />
              <OptionCard
                id="aids-off"
                groupName="aids"
                title="Hide"
                description="Hide box indicator (show only the graph)"
                selected={rightEdgeAids === "off"}
                onSelect={() => setRightEdgeAids("off")}
              />

              {/* Dataset (simple select + refresh) */}
              <SectionTitle text="Dataset" />
              <div style={{ margin: "8px 0 4px 0", color: "#4a5568", fontSize: 13 }}>
                Choose a dataset (the server will reset the session).
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  disabled={loadingDatasets || !datasets.length}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #d0d0d0",
                    background: "#fff",
                    color: "#2d3748",
                    fontSize: 15,
                  }}
                >
                  {datasets.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={fetchDatasets}
                  disabled={loadingDatasets}
                  title="Reload datasets from server"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#e2e8f0",
                    color: "#2d3748",
                    border: "none",
                    fontSize: 15,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loadingDatasets ? "Loading…" : "Refresh"}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={saveAndRestart}
                  disabled={saving || !selectedDataset}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  {saving ? "Applying…" : "Save & Restart"}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#e2e8f0",
                    color: "#2d3748",
                    border: "none",
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- small presentational bits ---------- */

function LoginCard({ pwd, setPwd, err, tryUnlock }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #d0d0d0",
        padding: 20,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <p style={{ fontSize: 15, color: "#4a5568", marginTop: 0, marginBottom: 14 }}>
        Enter the password to access the User Study panel.
      </p>
      <input
        type="password"
        placeholder="Password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 8,
          border: "1px solid #d0d0d0",
          background: "#fff",
          color: "#2d3748",
          fontSize: 15,
          marginBottom: 10,
        }}
      />
      {err && (
        <div style={{ background: "rgba(220,53,69,0.1)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <span style={{ color: "#dc3545", fontSize: 14 }}>{err}</span>
        </div>
      )}
      <button
        onClick={tryUnlock}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          background: "#2563eb",
          color: "white",
          border: "none",
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Enter
      </button>
    </div>
  );
}

function SectionTitle({ text }) {
  return (
    <h3 style={{ marginTop: 18, marginBottom: 8, fontSize: 16, fontWeight: 600, color: "#2d3748" }}>
      {text}
    </h3>
  );
}

function OptionCard({ id, title, description, selected, onSelect, groupName }) {
  return (
    <label
      htmlFor={id}
      onClick={onSelect}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        margin: "8px 0",
        border: selected ? "2px solid #6c86a7" : "1px solid #d0d0d0",
        borderRadius: 10,
        background: selected ? "rgba(108,134,167,0.08)" : "#fff",
        cursor: "pointer",
      }}
    >
      <input
        id={id}
        name={groupName}            // <-- separate groups per section
        type="radio"
        checked={selected}
        readOnly
        style={{ marginTop: 4 }}
      />
      <div>
        <div style={{ fontWeight: 600, color: "#2d3748" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#4a5568" }}>{description}</div>
      </div>
    </label>
  );
}
