import express, { Request, Response } from 'express';
import {
  getPeriodStatus,
  logPeriodStart,
  updatePeriodSettings,
  deletePeriodEntry
} from '../services/periodService';

const router = express.Router();

// GET /api/period - Get current cycle day count, next expected date, phase & history
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const status = await getPeriodStatus(userId);
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/period/log - Log a period start date
router.post('/log', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { startDate, cycleLength, periodDuration, notes } = req.body;

    const targetDate = startDate ? new Date(startDate) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start date' });
    }

    const status = await logPeriodStart(userId, targetDate, {
      cycleLength: cycleLength ? Number(cycleLength) : undefined,
      periodDuration: periodDuration ? Number(periodDuration) : undefined,
      notes
    });

    res.status(201).json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/period/settings - Update cycle length, period duration, or WhatsApp reminder toggle
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { cycleLength, periodDuration, reminderEnabled } = req.body;

    const status = await updatePeriodSettings(userId, {
      cycleLength: cycleLength ? Number(cycleLength) : undefined,
      periodDuration: periodDuration ? Number(periodDuration) : undefined,
      reminderEnabled: typeof reminderEnabled === 'boolean' ? reminderEnabled : undefined
    });

    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/period/:id - Delete a specific history entry or 'all' to reset
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { id } = req.params;
    const status = await deletePeriodEntry(userId, String(id));
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
