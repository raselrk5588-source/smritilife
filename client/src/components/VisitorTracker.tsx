import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getVisitorId = (): string => {
  try {
    let vid = localStorage.getItem('smriti_visitor_id');
    if (!vid) {
      vid = 'v_' + generateUUID();
      localStorage.setItem('smriti_visitor_id', vid);
    }
    return vid;
  } catch (e) {
    return 'v_' + generateUUID();
  }
};

const getSessionId = (): string => {
  try {
    let sid = sessionStorage.getItem('smriti_session_id');
    if (!sid) {
      sid = 's_' + generateUUID();
      sessionStorage.setItem('smriti_session_id', sid);
    }
    return sid;
  } catch (e) {
    return 's_' + generateUUID();
  }
};

export default function VisitorTracker() {
  const location = useLocation();
  const lastTrackedPath = useRef<string>('');
  const lastTrackedTime = useRef<number>(0);

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    // Skip admin panel paths to avoid skewing public visitor analytics
    if (location.pathname.startsWith('/admin')) {
      return;
    }

    // Debounce duplicate tracking within 3 seconds for the same route
    const now = Date.now();
    if (lastTrackedPath.current === currentPath && now - lastTrackedTime.current < 3000) {
      return;
    }

    lastTrackedPath.current = currentPath;
    lastTrackedTime.current = now;

    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const width = window.innerWidth;
    const device = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

    // Delay 300ms so document.title can update if changed by router
    const timer = setTimeout(() => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        fetch(`${apiUrl}/visitors/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            visitorId,
            sessionId,
            path: currentPath,
            pageTitle: document.title || 'Smriti Life',
            referrer: document.referrer || '',
            device
          }),
          // Keepalive ensures tracking completes even if the user navigates away quickly
          keepalive: true
        }).catch(() => {
          // Silently ignore network errors so app experience is never affected
        });
      } catch (err) {
        // Silently ignore
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
}
