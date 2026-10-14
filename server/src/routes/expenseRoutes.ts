import express, { Request, Response } from 'express';
import Expense from '../models/Expense';
import { recordExpense, getExpenseSummary, detectExpenseCategory } from '../services/expenseService';

const router = express.Router();

// GET /api/expenses - List expenses with optional pagination & filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { category, month, year, limit = 50, page = 1 } = req.query;

    const query: any = { userId };
    if (category && category !== 'all') {
      query.category = category;
    }

    if (month && year) {
      const m = parseInt(month as string, 10);
      const y = parseInt(year as string, 10);
      const startDate = new Date(Date.UTC(y, m - 1, 1));
      const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      query.date = { $gte: startDate, $lte: endDate };
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit as string, 10));

    const total = await Expense.countDocuments(query);

    res.json({ success: true, expenses, total });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/expenses/summary - Today & Monthly Summary with Breakdown
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const summary = await getExpenseSummary(userId);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/expenses - Create new expense manually
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { title, amount, category, paymentMethod, date, notes } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ success: false, message: 'Title and amount are required' });
    }

    const cat = category ? { id: category, nameBn: detectExpenseCategory(category).nameBn } : detectExpenseCategory(title);

    const expense = await Expense.create({
      userId,
      title,
      amount: parseFloat(amount),
      category: cat.id,
      categoryBn: cat.nameBn,
      paymentMethod: paymentMethod || 'cash',
      date: date ? new Date(date) : new Date(),
      notes
    });

    res.status(201).json({ success: true, expense });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/expenses/:id - Update an expense
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { title, amount, category, paymentMethod, date, notes } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (category !== undefined) {
      updateData.category = category;
      updateData.categoryBn = detectExpenseCategory(category).nameBn;
    }
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (date !== undefined) updateData.date = new Date(date);
    if (notes !== undefined) updateData.notes = notes;

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: updateData },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({ success: true, expense });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
