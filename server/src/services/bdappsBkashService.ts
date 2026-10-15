import crypto from 'crypto';
import SystemSettings from '../models/SystemSettings';
import Subscription from '../models/Subscription';

export interface BdappsConfig {
  apiKey: string;
  apiSecret: string;
  redirectUrl: string;
  authUrl: string;
}

export const BDAPPS_AUTH_ENDPOINT = 'https://user.bdapps.com/sdk/subscription/authorize';

/**
 * Generate exactly 15 digits numeric request ID according to bdapps specification:
 * YYMMDDHHmmss (12 digits in UTC) + 3-digit random number (100-999) = 15 digits
 */
export function generateRequestId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const base =
    pad(d.getUTCFullYear() % 100) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds());

  const random = crypto.randomInt(100, 1000); // 3 digits
  return `${base}${random}`;
}

/**
 * Create lowercase hexadecimal SHA-512 signature:
 * SHA512(apiKey + "|" + requestTime + "|" + apiSecret)
 */
export function generateSignature(apiKey: string, requestTime: string, apiSecret: string): string {
  const source = `${apiKey}|${requestTime}|${apiSecret}`;
  return crypto.createHash('sha512').update(source, 'utf8').digest('hex');
}

/**
 * Retrieve active bdapps credentials from SystemSettings DB or Environment Variables
 */
export async function getBdappsConfig(): Promise<BdappsConfig> {
  let apiKey = process.env.BDAPPS_API_KEY || '';
  let apiSecret = process.env.BDAPPS_API_SECRET || '';
  let redirectUrl = process.env.BDAPPS_REDIRECT_URL || '';

  try {
    const settings = await SystemSettings.findOne();
    if (settings) {
      if (settings.bdappsApiKey && settings.bdappsApiKey.trim()) {
        apiKey = settings.bdappsApiKey.trim();
      }
      if (settings.bdappsApiSecret && settings.bdappsApiSecret.trim()) {
        apiSecret = settings.bdappsApiSecret.trim();
      }
      if (settings.bdappsRedirectUrl && settings.bdappsRedirectUrl.trim()) {
        redirectUrl = settings.bdappsRedirectUrl.trim();
      }
    }
  } catch (err) {
    console.error('Error fetching SystemSettings for bdapps:', err);
  }

  // Fallback redirect URL if still not configured
  if (!redirectUrl) {
    redirectUrl = 'https://smritilife.com/subscription-return';
  }

  return {
    apiKey,
    apiSecret,
    redirectUrl,
    authUrl: BDAPPS_AUTH_ENDPOINT
  };
}

export interface BuildAuthUrlOptions {
  msisdn?: string;
  customRedirectUrl?: string;
  userId?: string;
  amount?: number;
}

export interface BuildAuthUrlResult {
  authorizationUrl: string;
  requestId: string;
  requestTime: string;
  signature: string;
  apiKey: string;
  redirectUrl: string;
  msisdn?: string;
  paymentOption: string;
}

/**
 * Build the signed bdapps subscription authorization URL and record the pending subscription
 */
export async function createAuthorizationRequest(options: BuildAuthUrlOptions = {}): Promise<BuildAuthUrlResult> {
  const config = await getBdappsConfig();

  if (!config.apiKey || !config.apiSecret) {
    throw new Error('bdapps API Key and API Secret are not configured. Please set them in Admin Settings or .env');
  }

  const requestTime = new Date().toISOString();
  const requestId = generateRequestId();
  const signature = generateSignature(config.apiKey, requestTime, config.apiSecret);
  const redirectUrl = options.customRedirectUrl || config.redirectUrl;
  const paymentOption = 'bKash';

  const params = new URLSearchParams({
    apiKey: config.apiKey,
    requestId,
    requestTime,
    signature,
    redirectUrl,
    paymentOption
  });

  if (options.msisdn && options.msisdn.trim()) {
    // Clean up msisdn (accept 01XXXXXXXXX or 8801XXXXXXXXX)
    let cleaned = options.msisdn.trim().replace(/[^\d]/g, '');
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(2);
    }
    params.set('msisdn', cleaned);
  }

  const authorizationUrl = `${config.authUrl}?${params.toString()}`;

  // Log pending subscription in DB
  try {
    await Subscription.create({
      userId: options.userId || undefined,
      msisdn: options.msisdn,
      requestId,
      requestTime,
      amount: options.amount || 190,
      status: 'PENDING',
      paymentOption,
      signature,
      redirectUrl,
      meta: {
        rawAuthUrl: authorizationUrl
      }
    });
  } catch (err) {
    console.error('Failed to log pending subscription:', err);
  }

  return {
    authorizationUrl,
    requestId,
    requestTime,
    signature,
    apiKey: config.apiKey,
    redirectUrl,
    msisdn: options.msisdn,
    paymentOption
  };
}
