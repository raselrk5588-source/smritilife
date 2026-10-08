import mongoose from 'mongoose';
import { reminderQueue } from './queues/reminderQueue';

export const startCron = () => {
  console.log('🕒 Starting reminder cron job (Polling every minute)...');
  
  const checkReminders = async () => {
    if (mongoose.connection.readyState !== 1) return;
    
    try {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      
      const db = mongoose.connection.db;
      if (!db) return;

      const reminders = await db.collection('reminders').find({
        status: 'Pending',
        time: currentTime
      }).toArray();

      if (reminders.length > 0) {
        console.log(`[CRON] Found ${reminders.length} due reminders for ${currentTime}`);
        
        for (const reminder of reminders) {
          const user = await db.collection('users').findOne({ _id: reminder.userId });
          
          if (user && (user.whatsapp || user.mobile)) {
             const phone = user.whatsapp || user.mobile;
             
             await reminderQueue.add(`Reminder-${reminder._id}`, {
               reminderId: reminder._id.toString(),
               title: reminder.title,
               description: reminder.description,
               time: reminder.time,
               phone: phone
             });
             
             await db.collection('reminders').updateOne(
               { _id: reminder._id },
               { $set: { status: 'Completed' } }
             );
          }
        }
      }
    } catch (error) {
      console.error('[CRON] Error in cron job:', error);
    }
  };

  // Run immediately
  checkReminders();
  
  // And then every minute
  setInterval(checkReminders, 60000);
};
