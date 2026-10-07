import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="w-full bg-[#f6f8f9] min-h-screen relative overflow-x-hidden">
      <Outlet />
    </div>
  );
}
