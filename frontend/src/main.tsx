import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SharedAudioProvider } from './contexts/SharedAudioContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SharedAudioProvider>
      <App />
    </SharedAudioProvider>
  </React.StrictMode>
);