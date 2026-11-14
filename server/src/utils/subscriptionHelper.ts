import { IUser } from '../models/User';

export interface UserAccessStatus {
  hasAccess: boolean;
  isPaid: boolean;
  isTrial: boolean;
  isExpired: boolean;
  trialRemainingHours: number;
  trialRemainingDays: number;
  trialEndDate?: Date;
  status: 'PRO' | 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'UNSUBSCRIBED';
  message: string;
}

/**
 * Single source of truth for user access checking (Paid Subscription vs 3-Day Free Trial)
 */
export function checkUserAccess(user: IUser | null | undefined): UserAccessStatus {
  if (!user) {
    return {
      hasAccess: false,
      isPaid: false,
      isTrial: false,
      isExpired: false,
      trialRemainingHours: 0,
      trialRemainingDays: 0,
      status: 'UNSUBSCRIBED',
      message: 'ব্যবহারকারী পাওয়া যায়নি।'
    };
  }

  // 1. Check Paid Pro Subscription
  if (user.isSubscribed) {
    return {
      hasAccess: true,
      isPaid: true,
      isTrial: false,
      isExpired: false,
      trialRemainingHours: 0,
      trialRemainingDays: 0,
      status: 'PRO',
      message: 'প্রো সাবস্ক্রিপশন সক্রিয় রয়েছে।'
    };
  }

  // 2. Check 3-Day Free Trial
  if (user.trialEndDate) {
    const now = Date.now();
    const end = new Date(user.trialEndDate).getTime();
    const diffMs = end - now;

    if (diffMs > 0) {
      const remainingHours = Math.ceil(diffMs / (1000 * 60 * 60));
      const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        hasAccess: true,
        isPaid: false,
        isTrial: true,
        isExpired: false,
        trialRemainingHours: remainingHours,
        trialRemainingDays: remainingDays,
        trialEndDate: user.trialEndDate,
        status: 'TRIAL_ACTIVE',
        message: `৩ দিনের ফ্রি ট্রায়াল চলছে (বাকি ${remainingDays} দিন / ${remainingHours} ঘণ্টা)।`
      };
    } else {
      return {
        hasAccess: false,
        isPaid: false,
        isTrial: false,
        isExpired: true,
        trialRemainingHours: 0,
        trialRemainingDays: 0,
        trialEndDate: user.trialEndDate,
        status: 'TRIAL_EXPIRED',
        message: '৩ দিনের ফ্রি ট্রায়ালের মেয়াদ শেষ হয়ে গেছে। দয়া করে বিকাশ দিয়ে পেমেন্ট করুন।'
      };
    }
  }

  return {
    hasAccess: false,
    isPaid: false,
    isTrial: false,
    isExpired: false,
    trialRemainingHours: 0,
    trialRemainingDays: 0,
    status: 'UNSUBSCRIBED',
    message: 'সাবস্ক্রিপশন অথবা ফ্রি ট্রায়াল সক্রিয় নেই।'
  };
}

/**
 * Helper to normalize Bangladeshi phone number to 01XXXXXXXXX
 */
export function normalizeMobile(mobile: string): string {
  let cleaned = (mobile || '').trim().replace(/[^\d]/g, '');
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

