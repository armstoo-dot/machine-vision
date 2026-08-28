import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MachineVisionApp } from './app/MachineVisionApp';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MachineVisionApp />
  </StrictMode>,
);
