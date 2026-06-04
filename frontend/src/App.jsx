import { useEffect, useState } from 'react';
import AppBarComponent from './components/topbar/AppBar';
import SideBar from './components/sidebar/SideBar';
import GraphContainer from './components/graphs/GraphContainer';
import EventContainer from './components/events/EventContainer';
import PatternContainer from './components/patterns/PatternContainer';
import { VisibleGraphsProvider } from './components/graphs/GraphContext';
import { PatternProvider } from './components/patterns/PatternContext';
import { EventProvider } from './components/events/EventContext';
import DataManagementService from './components/dataService/DataManagementService';
import SettingsModal from './components/sidebar/SettingsModal';
import { RawDataProvider } from "./components/rawData/RawDataContext";


export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const createSession = async () => {
      try {
        const success = await DataManagementService.createSession();
        if (success) {
          setSessionReady(true);
          setIsSettingsOpen(true); // Open settings modal when session is ready
        } else {
          console.error("Failed to create session");
        }
      } catch (err) {
        console.error("Error creating session", err);
      }
    };

    createSession();
  }, []);

  if (!sessionReady) {
    return <div>Loading session...</div>;
  }


  return (
    <RawDataProvider>
      <VisibleGraphsProvider>
        <EventProvider>
          <PatternProvider>
            <div className="app-container" style={{ display: 'flex', flexDirection: 'row' }}>
              <SideBar />
              <div className="main-content" style={{ flex: 1 }}>
                <AppBarComponent />
                <EventContainer />
                <PatternContainer />
                <GraphContainer />
              </div>
              {isSettingsOpen && (
                <SettingsModal onClose={() => setIsSettingsOpen(false)} />
              )}
            </div>
          </PatternProvider>
        </EventProvider>
      </VisibleGraphsProvider>
    </RawDataProvider>
  );
}
