import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { Toaster } from 'react-hot-toast';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Notes from './pages/Notes';
import Reminders from './pages/Reminders';
import Calendar from './pages/Calendar';
import Contacts from './pages/Contacts';
import Wishes from './pages/Wishes';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import TodayTasks from './pages/TodayTasks';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import ViewWish from './pages/ViewWish';
import Paywall from './pages/Paywall';
import SubscriptionReturn from './pages/SubscriptionReturn';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import CompleteProfile from './pages/CompleteProfile';
import Ramadan from './pages/Ramadan';
import Expenses from './pages/Expenses';
import Debts from './pages/Debts';
import Documents from './pages/Documents';
import FCommerce from './pages/FCommerce';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import MaintenanceGuard from './components/MaintenanceGuard';
import VisitorTracker from './components/VisitorTracker';

function App() {
  return (
    <SettingsProvider>
      <Toaster position="top-center" toastOptions={{ style: { fontSize: '12px', fontWeight: 'bold' } }} />
      <Router>
        <VisitorTracker />
        <MaintenanceGuard>
          <Routes>
        {/* Public Marketing Page */}
        <Route path="/" element={<Landing />} />

        {/* Legal & Compliance Routes */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Authentication Route */}
        <Route path="/auth" element={<Auth />} />

        {/* Complete Profile after Payment */}
        <Route path="/complete-profile" element={<CompleteProfile />} />

        {/* Digital Greeting Card Route (Public) */}
        <Route path="/w/:id" element={<ViewWish />} />
        <Route path="/wish/:id" element={<ViewWish />} />
        
        {/* Subscription Paywall & Return Routes */}
        <Route path="/paywall" element={<Paywall />} />
        <Route path="/subscription-return" element={<SubscriptionReturn />} />
        
        {/* Consumer App */}
        <Route path="/app" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="notes" element={<Notes />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="wishes" element={<Wishes />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="today-tasks" element={<TodayTasks />} />
          <Route path="ramadan" element={<Ramadan />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="debts" element={<Debts />} />
          <Route path="documents" element={<Documents />} />
          <Route path="fcommerce" element={<FCommerce />} />
          <Route path="admin" element={<Profile />} /> {/* Re-mapped admin to Profile for the bottom nav link to work visually */}
        </Route>

        {/* Admin Portal */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
        </Route>
      </Routes>
      </MaintenanceGuard>
    </Router>
    </SettingsProvider>
  );
}

export default App;
