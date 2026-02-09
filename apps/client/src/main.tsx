import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Entrypoint for the client application.
createRoot(document.getElementById('root')!).render(<App />);