import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Separate entry — WHY: keeps App.jsx focused on UI; standard React 18 createRoot API.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
