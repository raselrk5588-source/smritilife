import express, { Request, Response } from 'express';
import Debt from '../models/Debt';
import {
  recordDebt,
  recordDebtPayment,
  getDebtSummary,
  getPersonDebtSummary,
  cleanPersonName
} from '../services/debtService';

const router = express.Router();

// GET /api/debts - List debts with filtering & search
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { type, status, search, limit = 50, page = 1 } = req.query;

    const query: any = { userId };

    if (type && type !== 'all') {
      query.type = type;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { personName: searchRegex },
        { personPhone: searchRegex },
        { notes: searchRegex }
      ];
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const debts = await Debt.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string, 10));

    const total = await Debt.countDocuments(query);

    res.json({ success: true, debts, total });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/debts/summary - Overall Debt Summary (Receivable, Payable, Net Balance)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const summary = await getDebtSummary(userId);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/debts/person/:name - Specific Person statement & balances
router.get('/person/:name', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const name = String(req.params.name);
    const summary = await getPersonDebtSummary(userId, name);

    if (!summary) {
      return res.status(404).json({ success: false, message: 'Person debt history not found' });
    }

    // Also get the list of debts for this person
    const debts = await Debt.find({
      userId,
      personName: { $regex: new RegExp(`^${cleanPersonName(name)}$`, 'i') }
    }).sort({ createdAt: -1 });

    res.json({ success: true, summary, debts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/debts - Create new debt entry
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { personName, personPhone, type, amount, dueDate, notes } = req.body;

    if (!personName || !amount || !type) {
      return res.status(400).json({ success: false, message: 'Person name, amount, and type are required' });
    }

    if (!['lent', 'borrowed'].includes(type)) {
      return res.status(400).json({ success: false, message: "Type must be either 'lent' or 'borrowed'" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    const debt = await recordDebt(userId, personName, numAmount, type, {
      personPhone,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes
    });

    res.status(201).json({ success: true, debt });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/debts/:id/pay - Record repayment or partial payment
router.post('/:id/pay', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { amount, note } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required' });
    }

    const updatedDebt = await recordDebtPayment(id, numAmount, note);
    if (!updatedDebt) {
      return res.status(404).json({ success: false, message: 'Debt entry not found' });
    }

    res.json({ success: true, debt: updatedDebt });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/debts/:id - Update debt info
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { id } = req.params;
    const { personName, personPhone, dueDate, notes, status } = req.body;

    const debt = await Debt.findOne({ _id: id, userId });
    if (!debt) {
      return res.status(404).json({ success: false, message: 'Debt entry not found' });
    }

    if (personName) debt.personName = cleanPersonName(personName);
    if (personPhone !== undefined) debt.personPhone = personPhone.trim();
    if (dueDate !== undefined) debt.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (notes !== undefined) debt.notes = notes;
    if (status && ['pending', 'partial', 'settled'].includes(status)) {
      debt.status = status;
    }

    await debt.save();
    res.json({ success: true, debt });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/debts/:id - Delete debt entry
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { id } = req.params;

    const deleted = await Debt.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Debt entry not found' });
    }

    res.json({ success: true, message: 'Debt entry deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
