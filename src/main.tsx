import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/michroma/latin-400.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import { MachineVisionApp } from './app/MachineVisionApp';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MachineVisionApp />
  </StrictMode>,
);
