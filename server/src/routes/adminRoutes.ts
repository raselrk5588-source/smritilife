import express from 'express';
import { setupAdmin, loginAdmin, getAnalytics, getUsers, toggleSubscription, createDemoUser, getTemplates, createTemplate, updateTemplate, deleteTemplate, getSettings, updateSettings, getAllReminders, deleteAnyReminder, getAllWishes, deleteAnyWish, getErrorLogs, logClientError, getTrainingRules, createTrainingRule, updateTrainingRule, deleteTrainingRule } from '../controllers/adminController';
import { getVisitorAnalytics } from '../controllers/visitorController';

const router = express.Router();

router.post('/setup', setupAdmin);
router.post('/login', loginAdmin);
router.get('/analytics', getAnalytics);
router.get('/visitor-analytics', getVisitorAnalytics);
router.get('/users', getUsers);
router.post('/users/create-demo', createDemoUser);
router.put('/users/:id/subscribe', toggleSubscription);

router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/reminders', getAllReminders);
router.delete('/reminders/:id', deleteAnyReminder);

router.get('/wishes', getAllWishes);
router.delete('/wishes/:id', deleteAnyWish);

router.get('/errors', getErrorLogs);
router.post('/errors', logClientError);

router.get('/training-rules', getTrainingRules);
router.post('/training-rules', createTrainingRule);
router.put('/training-rules/:id', updateTrainingRule);
router.delete('/training-rules/:id', deleteTrainingRule);

export default router;
