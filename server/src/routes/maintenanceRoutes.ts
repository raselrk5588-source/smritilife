import { Router, Request, Response } from 'express';
import { getMaintenanceStatus, updateMaintenanceCache } from '../services/maintenanceService';
import SystemSettings from '../models/SystemSettings';

const router = Router();

/**
 * @route GET /api/maintenance/status
 * @desc Get public maintenance mode status for client apps
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getMaintenanceStatus();
    return res.json({
      success: true,
      isMaintenanceMode: status.isMaintenanceMode,
      title: status.maintenanceTitle,
      message: status.maintenanceMessage,
      estimatedTime: status.maintenanceEstimatedTime
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
