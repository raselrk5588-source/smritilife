import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const logErrorToBackend = async (message: string, stack?: string) => {
  try {
    // Only log in production or if needed
    const token = localStorage.getItem('token');
    const user = token ? JSON.parse(atob(token.split('.')[1])) : null;
    
    await fetch(`${import.meta.env.VITE_API_URL}/admin/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        stack,
        path: window.location.pathname,
        userId: user?.id
      })
    });
  } catch (e) {
    console.error('Failed to send error log', e);
  }
};

window.addEventListener('error', (event) => {
  logErrorToBackend(event.message, event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  logErrorToBackend(event.reason?.message || 'Unhandled Promise Rejection', event.reason?.stack);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
