import { Home, MessageSquare, Bell, User, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'home', icon: Home, path: '/home', label: 'Home' },
    { id: 'chats', icon: MessageSquare, path: '/chats', label: 'Chats' },
    { id: 'notifications', icon: Bell, path: '/notifications', label: 'Alerts' },
    { id: 'profile', icon: User, path: '/profile', label: 'Profile' },
    { id: 'settings', icon: Settings, path: '/settings', label: 'Settings' },
  ];

  return (
    <div className="absolute bottom-0 w-full glass-nav flex justify-between items-center px-6 py-3 pb-5 z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
      {navItems.map((item) => {
        const isActive = location.pathname.includes(item.path);
        const Icon = item.icon;
        
        return (
          <button 
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ease-out ${
              isActive ? 'text-chatverse -translate-y-1' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-indigo-50' : ''}`}>
              <Icon className={`w-[22px] h-[22px] ${isActive ? 'fill-indigo-100 stroke-chatverse' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            </div>
          </button>
        );
      })}
    </div>
  );
}