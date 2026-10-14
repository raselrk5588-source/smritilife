import express from 'express';
import { getRamadanTimes, matchDistrict, BD_DISTRICTS, RAMADAN_DUAS } from '../services/ramadanService';
import User from '../models/User';

const router = express.Router();

// GET /api/ramadan/times?district=...
router.get('/times', (req, res) => {
  try {
    const districtQuery = (req.query.district as string) || 'Dhaka';
    const times = getRamadanTimes(districtQuery);
    res.json({
      success: true,
      times,
      districts: BD_DISTRICTS.map(d => ({ id: d.id, nameEn: d.nameEn, nameBn: d.nameBn }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/ramadan/duas
router.get('/duas', (req, res) => {
  res.json({ success: true, duas: RAMADAN_DUAS });
});

// GET /api/ramadan/settings
router.get('/settings', async (req: any, res) => {
  try {
    const user = await User.findById(req.user?._id);
    res.json({
      success: true,
      district: user?.district || 'Dhaka',
      ramadanAlerts: user?.ramadanAlerts || {
        enabled: true,
        sehriAlert: true,
        sehriMinutesBefore: 40,
        iftarAlert: true
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/ramadan/settings
router.put('/settings', async (req: any, res) => {
  try {
    const { district, ramadanAlerts } = req.body;
    const updateData: any = {};
    if (district) {
      const matched = matchDistrict(district);
      updateData.district = matched.nameEn;
    }
    if (ramadanAlerts) {
      updateData.ramadanAlerts = ramadanAlerts;
    }

    const updated = await User.findByIdAndUpdate(req.user?._id, { $set: updateData }, { new: true });
    res.json({
      success: true,
      message: 'রমজানের সেটিংস সফলভাবে আপডেট করা হয়েছে',
      district: updated?.district,
      ramadanAlerts: updated?.ramadanAlerts
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
