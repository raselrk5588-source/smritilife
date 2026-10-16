import { Request, Response } from 'express';
import VisitorLog, { getBangladeshDateStr, getBangladeshHour } from '../models/VisitorLog';

// Helper to detect device from user-agent if client didn't supply it
const detectDevice = (ua: string = ''): 'mobile' | 'desktop' | 'tablet' | 'other' => {
  const lower = ua.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(lower)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|blackberry|phone|iemobile/i.test(lower)) return 'mobile';
  if (/windows|macintosh|linux/i.test(lower)) return 'desktop';
  return 'mobile'; // default to mobile since majority of users are on mobile
};

// Helper to detect browser
const detectBrowser = (ua: string = ''): string => {
  if (/edg/i.test(ua)) return 'Edge';
  if (/opr|opera/i.test(ua)) return 'Opera';
  if (/samsung/i.test(ua)) return 'Samsung Internet';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/fbav|fban/i.test(ua)) return 'Facebook App';
  if (/whatsapp/i.test(ua)) return 'WhatsApp';
  return 'Other';
};

// Helper to detect OS
const detectOS = (ua: string = ''): string => {
  if (/windows/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
};

// POST /api/visitors/track
export const trackVisit = async (req: Request, res: Response) => {
  try {
    const {
      visitorId,
      sessionId,
      path = '/',
      pageTitle = '',
      referrer = '',
      device: clientDevice,
      browser: clientBrowser,
      os: clientOS,
      userId
    } = req.body;

    // Skip admin or API routes to prevent polluting customer analytics
    if (!path || path.startsWith('/admin') || path.startsWith('/api')) {
      return res.json({ success: true, ignored: true });
    }

    if (!visitorId || !sessionId) {
      return res.status(400).json({ success: false, message: 'visitorId and sessionId are required' });
    }

    const ua = (req.headers['user-agent'] as string) || '';
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const clientIp = rawIp.split(',')[0].trim();

    const device = clientDevice || detectDevice(ua);
    const browser = clientBrowser || detectBrowser(ua);
    const os = clientOS || detectOS(ua);

    const dateStr = getBangladeshDateStr();
    const yearMonth = dateStr.slice(0, 7);
    const hour = getBangladeshHour();

    // Check if this visitorId has already been recorded today
    const alreadyVisitedToday = await VisitorLog.exists({ visitorId, dateStr });
    const isUniqueDailyVisit = !alreadyVisitedToday;

    await VisitorLog.create({
      visitorId,
      sessionId,
      path: path.slice(0, 300),
      pageTitle: (pageTitle || '').slice(0, 200),
      referrer: (referrer || '').slice(0, 300),
      ip: clientIp.slice(0, 60),
      userAgent: ua.slice(0, 500),
      device,
      browser,
      os,
      dateStr,
      yearMonth,
      hour,
      isUniqueDailyVisit,
      userId: userId || null
    });

    res.json({ success: true, isUniqueDailyVisit });
  } catch (error: any) {
    console.error('Error tracking visit:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/visitor-analytics
export const getVisitorAnalytics = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'month'; // 'today' | 'week' | 'month' | 'custom'
    const todayStr = getBangladeshDateStr();

    let startDateStr = '';
    let endDateStr = todayStr;

    if (period === 'today') {
      startDateStr = todayStr;
      endDateStr = todayStr;
    } else if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startDateStr = getBangladeshDateStr(d);
    } else if (period === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      startDateStr = getBangladeshDateStr(d);
    } else if (period === 'custom') {
      startDateStr = (req.query.startDate as string) || todayStr;
      endDateStr = (req.query.endDate as string) || todayStr;
    } else {
      // Default fallback 30 days
      const d = new Date();
      d.setDate(d.getDate() - 29);
      startDateStr = getBangladeshDateStr(d);
    }

    const dateFilter = {
      dateStr: { $gte: startDateStr, $lte: endDateStr }
    };

    // 1. Overall stats for selected period
    const totalPageViews = await VisitorLog.countDocuments(dateFilter);

    // Aggregate unique visitors & sessions in period
    const [totals] = await VisitorLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          uniqueVisitors: { $addToSet: '$visitorId' },
          totalSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          _id: 0,
          uniqueVisitorsCount: { $size: '$uniqueVisitors' },
          totalSessionsCount: { $size: '$totalSessions' }
        }
      }
    ]);

    const uniqueVisitors = totals?.uniqueVisitorsCount || 0;
    const totalSessions = totals?.totalSessionsCount || 0;

    // 2. Today's live snapshot
    const todayPageViews = await VisitorLog.countDocuments({ dateStr: todayStr });
    const [todayTotals] = await VisitorLog.aggregate([
      { $match: { dateStr: todayStr } },
      {
        $group: {
          _id: null,
          uniqueVisitors: { $addToSet: '$visitorId' },
          totalSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          _id: 0,
          uniqueVisitorsCount: { $size: '$uniqueVisitors' },
          totalSessionsCount: { $size: '$totalSessions' }
        }
      }
    ]);
    const todayUniqueVisitors = todayTotals?.uniqueVisitorsCount || 0;
    const todaySessions = todayTotals?.totalSessionsCount || 0;

    // 3. Date-wise Breakdown
    const dailyStats = await VisitorLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$dateStr',
          pageViews: { $sum: 1 },
          uniqueVisitorsSet: { $addToSet: '$visitorId' },
          sessionsSet: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          pageViews: 1,
          uniqueVisitors: { $size: '$uniqueVisitorsSet' },
          sessions: { $size: '$sessionsSet' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // 4. Device Breakdown
    const deviceAgg = await VisitorLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const deviceBreakdown = deviceAgg.map(item => ({
      device: item._id || 'other',
      count: item.count,
      percentage: totalPageViews > 0 ? Math.round((item.count / totalPageViews) * 100) : 0
    }));

    // 5. Top Visited Pages
    const topPagesAgg = await VisitorLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$path', views: { $sum: 1 }, uniqueVisitorsSet: { $addToSet: '$visitorId' } } },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ]);
    const topPages = topPagesAgg.map(item => ({
      path: item._id,
      views: item.views,
      uniqueVisitors: item.uniqueVisitorsSet.length
    }));

    // 6. Top Referrers
    const topReferrersAgg = await VisitorLog.aggregate([
      { $match: { ...dateFilter, referrer: { $exists: true, $ne: '' } } },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);
    const topReferrers = topReferrersAgg.map(item => ({
      referrer: item._id,
      count: item.count
    }));

    // 7. Recent 25 Visits
    const recentVisits = await VisitorLog.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(25)
      .select('visitorId path pageTitle device browser os ip dateStr createdAt isUniqueDailyVisit');

    res.json({
      success: true,
      data: {
        summary: {
          totalPageViews,
          uniqueVisitors,
          totalSessions,
          todayPageViews,
          todayUniqueVisitors,
          todaySessions
        },
        period,
        startDate: startDateStr,
        endDate: endDateStr,
        dailyStats,
        deviceBreakdown,
        topPages,
        topReferrers,
        recentVisits
      }
    });
  } catch (error: any) {
    console.error('Error fetching visitor analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
