import SystemSettings from '../models/SystemSettings';

interface MaintenanceInfo {
  isMaintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceEstimatedTime: string;
  maintenanceAllowedIps: string[];
}

let cachedMaintenance: {
  data: MaintenanceInfo;
  expiresAt: number;
} | null = null;

const DEFAULT_MAINTENANCE: MaintenanceInfo = {
  isMaintenanceMode: false,
  maintenanceTitle: 'সিস্টেম আপগ্রেড ও রক্ষণাবেক্ষণ চলছে',
  maintenanceMessage: 'স্মৃতিকে আরও দ্রুত ও উন্নত করতে বর্তমানে সিস্টেম আপগ্রেডের কাজ চলছে। খুব শীঘ্রই আমরা আবার পুরোদমে ফিরে আসছি। আপনার সাময়িক অসুবিধার জন্য আন্তরিকভাবে দুঃখিত।',
  maintenanceEstimatedTime: '১৫-২০ মিনিট',
  maintenanceAllowedIps: []
};

/**
 * Get current maintenance mode status with memory caching
 */
export const getMaintenanceStatus = async (forceFresh = false): Promise<MaintenanceInfo> => {
  const now = Date.now();
  if (!forceFresh && cachedMaintenance && cachedMaintenance.expiresAt > now) {
    return cachedMaintenance.data;
  }

  try {
    const settings = await SystemSettings.findOne().lean();
    if (!settings) {
      cachedMaintenance = { data: DEFAULT_MAINTENANCE, expiresAt: now + 15000 };
      return DEFAULT_MAINTENANCE;
    }

    const info: MaintenanceInfo = {
      isMaintenanceMode: Boolean(settings.isMaintenanceMode),
      maintenanceTitle: settings.maintenanceTitle || DEFAULT_MAINTENANCE.maintenanceTitle,
      maintenanceMessage: settings.maintenanceMessage || DEFAULT_MAINTENANCE.maintenanceMessage,
      maintenanceEstimatedTime: settings.maintenanceEstimatedTime || DEFAULT_MAINTENANCE.maintenanceEstimatedTime,
      maintenanceAllowedIps: Array.isArray(settings.maintenanceAllowedIps) ? settings.maintenanceAllowedIps : []
    };

    cachedMaintenance = { data: info, expiresAt: now + 15000 };
    return info;
  } catch (err) {
    console.error('Error reading maintenance status:', err);
    return cachedMaintenance ? cachedMaintenance.data : DEFAULT_MAINTENANCE;
  }
};

/**
 * Invalidate and immediately update maintenance cache
 */
export const updateMaintenanceCache = (info: Partial<MaintenanceInfo>) => {
  const current = cachedMaintenance?.data || DEFAULT_MAINTENANCE;
  cachedMaintenance = {
    data: {
      ...current,
      ...info
    },
    expiresAt: Date.now() + 15000
  };
};
