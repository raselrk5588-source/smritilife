import { Request, Response, NextFunction } from 'express';
import { getMaintenanceStatus } from '../services/maintenanceService';

/**
 * Global Maintenance Mode Middleware.
 * When enabled via Admin Panel, non-admin API requests receive HTTP 503 Service Unavailable
 * with detailed maintenance status.
 */
export const maintenanceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Exempt paths:
    // 1. Admin endpoints (so admin can log in and manage system / disable maintenance)
    // 2. Maintenance status endpoint (so frontend can check status)
    // 3. Health check (so container health monitors don't fail)
    // 4. WhatsApp webhook (handled gracefully inside WhatsApp service)
    // 5. Static file uploads
    const path = req.path || req.originalUrl;
    
    if (
      path.startsWith('/api/admin') ||
      path.startsWith('/api/visitors') ||
      path.startsWith('/api/maintenance') ||
      path.startsWith('/api/health') ||
      path.startsWith('/api/whatsapp') ||
      path.startsWith('/uploads') ||
      path.startsWith('/api/uploads')
    ) {
      return next();
    }

    const status = await getMaintenanceStatus();
    if (!status.isMaintenanceMode) {
      return next();
    }

    // Check if client IP is whitelisted
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
    if (status.maintenanceAllowedIps && status.maintenanceAllowedIps.length > 0) {
      if (status.maintenanceAllowedIps.includes(clientIp)) {
        return next();
      }
    }

    return res.status(503).json({
      success: false,
      maintenance: true,
      title: status.maintenanceTitle,
      message: status.maintenanceMessage,
      estimatedTime: status.maintenanceEstimatedTime
    });
  } catch (err) {
    console.error('Maintenance middleware error:', err);
    return next();
  }
};
