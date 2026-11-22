import { Request, Response } from 'express';
import { triggerSosAlert, updateEmergencyProfile, resolveSosAlert } from '../services/sosService';
import User from '../models/User';
import SosAlert from '../models/SosAlert';

/**
 * POST /api/sos/trigger
 * Triggers SOS alert from Web / App
 */
export const triggerWebSos = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { latitude, longitude, address, note } = req.body;
    console.log('[triggerWebSos] received payload:', { latitude, longitude, address, note });

    const numLat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : undefined;
    const numLng = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : undefined;

    const result = await triggerSosAlert({
      userId: userId.toString(),
      source: 'web',
      latitude: numLat && !isNaN(numLat) ? numLat : undefined,
      longitude: numLng && !isNaN(numLng) ? numLng : undefined,
      address: address ? String(address).trim() : undefined,
      note: note ? String(note).trim() : undefined
    });

    return res.json(result);
  } catch (error: any) {
    console.error('triggerWebSos error:', error);
    return res.status(500).json({ success: false, message: error.message || 'সার্ভার ত্রুটি হয়েছে।' });
  }
};

/**
 * GET /api/sos/profile
 * Returns emergency contacts, blood group, medical notes, and recent alerts
 */
export const getSosProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const user = await User.findById(userId).select('name mobile whatsapp bloodGroup emergencyContacts medicalNotes');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const recentAlerts = await SosAlert.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.json({
      success: true,
      profile: {
        bloodGroup: user.bloodGroup || '',
        emergencyContacts: user.emergencyContacts || [],
        medicalNotes: user.medicalNotes || ''
      },
      recentAlerts
    });
  } catch (error: any) {
    console.error('getSosProfile error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/sos/profile
 * Updates emergency contacts, blood group, and medical notes
 */
export const updateSosProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const { bloodGroup, emergencyContacts, medicalNotes } = req.body;

    const result = await updateEmergencyProfile(userId.toString(), {
      bloodGroup,
      emergencyContacts,
      medicalNotes
    });

    return res.json(result);
  } catch (error: any) {
    console.error('updateSosProfile error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/sos/resolve
 * Marks active alert as resolved ("I am safe now")
 */
export const resolveSos = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const { alertId } = req.body;

    const success = await resolveSosAlert(userId.toString(), alertId);
    return res.json({
      success,
      message: success
        ? '✅ আপনার জরুরি অ্যালার্ট সফলভাবে বন্ধ করা হয়েছে এবং অভিভাবকদের নিরাপদ থাকার বার্তা পাঠানো হয়েছে।'
        : 'কোনো সক্রিয় অ্যালার্ট পাওয়া যায়নি।'
    });
  } catch (error: any) {
    console.error('resolveSos error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
