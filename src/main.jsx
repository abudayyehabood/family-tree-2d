import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

document.getElementById('boot')?.remove();     // the app came up, drop the notice

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
