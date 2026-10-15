import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Maintenance from '../pages/Maintenance';

interface MaintenanceState {
  isMaintenanceMode: boolean;
  title?: string;
  message?: string;
  estimatedTime?: string;
}

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [state, setState] = useState<MaintenanceState>({
    isMaintenanceMode: false
  });
  const [hasChecked, setHasChecked] = useState(false);

  const checkMaintenance = useCallback(async () => {
    // If user is already navigating to an admin route, skip maintenance blocking
    if (location.pathname.startsWith('/admin')) {
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${apiUrl}/maintenance/status`, {
        cache: 'no-store'
      });

      if (res.status === 503) {
        // Backend actively in maintenance
        const data = await res.json().catch(() => ({}));
        setState({
          isMaintenanceMode: true,
          title: data.title,
          message: data.message,
          estimatedTime: data.estimatedTime
        });
      } else if (res.ok) {
        const data = await res.json();
        if (data && data.isMaintenanceMode) {
          setState({
            isMaintenanceMode: true,
            title: data.title,
            message: data.message,
            estimatedTime: data.estimatedTime
          });
        } else {
          setState({ isMaintenanceMode: false });
        }
      } else if (res.status === 502 || res.status === 504) {
        // Backend restarting / proxy down during deployment
        setState({
          isMaintenanceMode: true,
          title: 'সিস্টেম ডেপ্লয়মেন্ট ও আপডেট চলছে',
          message: 'আমাদের সিস্টেমে আপডেট ইনস্টল করা হচ্ছে। সাময়িক অসুবিধার জন্য আন্তরিকভাবে ক্ষমাপ্রার্থী। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।',
          estimatedTime: '১ - ২ মিনিট'
        });
      }
    } catch (err) {
      // If network fails completely (e.g. server down during docker build)
      // Check if it's not admin route
      console.warn('Maintenance check notice: backend not reachable yet');
    } finally {
      setHasChecked(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    checkMaintenance();

    // Recheck periodically every 15 seconds
    const interval = setInterval(checkMaintenance, 15000);
    return () => clearInterval(interval);
  }, [checkMaintenance]);

  // Admin routes always pass through
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // If maintenance is active, render the Maintenance Screen!
  if (state.isMaintenanceMode) {
    return (
      <Maintenance
        title={state.title}
        message={state.message}
        estimatedTime={state.estimatedTime}
        onRefresh={checkMaintenance}
      />
    );
  }

  return <>{children}</>;
}
