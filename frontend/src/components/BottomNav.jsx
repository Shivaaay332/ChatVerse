import { useState, useEffect } from 'react';
import { Home, MessageSquare, Bell, User, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Poll for both notifications and unread messages every 5 seconds for Real-time UX
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const notifRes = await api.get('/notifications/unread');
        const notifCount = notifRes.data.unread || 0;
        setUnreadCount(notifCount);

        const msgRes = await api.get('/messages/unread/total');
        const msgCount = msgRes.data.unreadMessages || 0;
        setUnreadMessagesCount(msgCount);

        // FIX: App Icon par Red Dot Badge lagana (WhatsApp style)
        const totalUnread = notifCount + msgCount;
        if (navigator.setAppBadge) {
          if (totalUnread > 0) navigator.setAppBadge(totalUnread);
          else navigator.clearAppBadge();
        }
      } catch (err) { /* silently fail */ }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); 
    
    return () => clearInterval(interval);
  }, [location.pathname]); 

  const navItems = [
    { id: 'home', icon: Home, path: '/home', label: 'Home' },
    { id: 'chats', icon: MessageSquare, path: '/chats', label: 'Chats' },
    { id: 'notifications', icon: Bell, path: '/notifications', label: 'Alerts' },
    { id: 'profile', icon: User, path: '/profile', label: 'Profile' },
    { id: 'settings', icon: Settings, path: '/settings', label: 'Settings' },
  ];

  return (
    <div className="absolute bottom-0 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 flex justify-between items-center px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+4px)] z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-none transition-colors">
      {navItems.map((item) => {
        const isActive = location.pathname.includes(item.path);
        const Icon = item.icon;
        
        return (
          <button 
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ease-out ${
              isActive ? 'text-chatverse -translate-y-1' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-400'
            }`}
          >
            <div className={`relative p-2 rounded-full transition-all duration-300 ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/40' : ''}`}>
              <Icon className={`w-[20px] h-[20px] ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              
              {/* Premium Red Dot for Notifications */}
              {item.id === 'notifications' && unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-[9px] h-[9px] bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></span>
              )}

              {/* Chat Unread Badge with Number */}
              {item.id === 'chats' && unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm animate-bounce">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </div>
            
            <span className={`text-[9px] font-bold transition-all duration-300 ${
              isActive ? 'opacity-100' : 'opacity-0 translate-y-2'
            }`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}