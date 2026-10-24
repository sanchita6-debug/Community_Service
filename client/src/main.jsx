/**
 * Entry point.
 *
 * Nothing renders until the saved language is known, so a person who chose
 * Bengali never sees a flash of English first. SettingsProvider reads
 * localStorage synchronously in its initialiser, which is what makes that
 * possible without a loading spinner on first paint.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('VoicePay: #root element is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
