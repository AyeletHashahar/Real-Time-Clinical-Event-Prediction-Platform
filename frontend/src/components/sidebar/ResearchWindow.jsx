import React from 'react';
import ReactDOM from 'react-dom/client';
import { VisibleGraphsProvider } from '../graphs/GraphContext';
import { PatternProvider } from '../patterns/PatternContext';
import { EventProvider } from '../events/EventContext';
import {ResearchContent} from '../research/ResearchContent'; // if using `export default`


export const openResearchWindow = () => {
  const newWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!newWindow) return;

  const doc = newWindow.document;
  doc.title = 'Research Dashboard';

  const container = doc.createElement('div');
  doc.body.appendChild(container);

  const style = doc.createElement('style');
  style.innerHTML = `body { margin: 0; font-family: sans-serif; }`;
  doc.head.appendChild(style);

  // Create the same context tree as your main App.jsx
  const root = ReactDOM.createRoot(container);
  root.render(
    <VisibleGraphsProvider>
      <EventProvider>
        <PatternProvider>
          <ResearchContent />
        </PatternProvider>
      </EventProvider>
    </VisibleGraphsProvider>
  );
};