import { Home, MessageSquare, Bell, User, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const msgRes = await api.get('/messages/unread/total');
        setUnreadMessages(msgRes.data.unreadMessages || 0);
        
        const notifRes = await api.get('/notifications/unread');
        setUnreadNotifs(notifRes.data.unread || 0);
        
        const total = (msgRes.data.unreadMessages || 0) + (notifRes.data.unread || 0);
        if ('setAppBadge' in navigator) {
          if (total > 0) navigator.setAppBadge(total).catch(()=>{});
          else navigator.clearAppBadge().catch(()=>{});
        }
      } catch(e) {}
    };
    fetchStats();
    
    // Har 5 second me silent update karega red dot ke liye
    const intv = setInterval(fetchStats, 5000);
    return () => clearInterval(intv);
  }, []);

  const navItems = [
    { icon: Home, path: '/', label: 'Feed' },
    { icon: MessageSquare, path: '/chats', label: 'Chats', badge: unreadMessages },
    { icon: Bell, path: '/notifications', label: 'Alerts', badge: unreadNotifs },
    { icon: User, path: '/profile', label: 'Profile' },
    { icon: Settings, path: '/settings', label: 'Settings' }
  ];

  return (
    // FIX: bg-white aur z-[100] is patti ko 100% solid banayega aur overlap roke ga
    <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-[100] pb-[calc(env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-[65px] px-2 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/profile' && location.pathname.startsWith('/user/'));
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center justify-center w-14 h-full transition-colors ${isActive ? 'text-chatverse dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              <div className="relative">
                <Icon className={`w-[24px] h-[24px] transition-transform ${isActive ? 'scale-110 fill-chatverse/20' : ''}`} />
                {/* Red Dot Badge */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-gray-900">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 ${isActive ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}