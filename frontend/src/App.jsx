import { io } from 'socket.io-client';
import { SOCKET_URL } from './api';
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Pages Import
import AuthScreen from './pages/AuthScreen';
import HomeFeed from './pages/HomeFeed';
import ChatList from './pages/ChatList';
import ChatScreen from './pages/ChatScreen';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';
import BlockedUsers from './pages/BlockedUsers'; 

// Components & API
import AppLockScreen from './components/AppLockScreen';
import api from './api';

function App() {
  const navigate = useNavigate();
  const [globalSocket, setGlobalSocket] = useState(null); // ✅ NAYA: Global Socket State
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('chatverse_token');
    const lockSetting = localStorage.getItem('chatverse_applock') === 'true';
    const isDark = localStorage.getItem('chatverse_darkmode') === 'true';
    
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    if (token) {
      setIsAuthenticated(true);
      if (lockSetting) setIsAppLocked(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleUpdateFound = () => setUpdateAvailable(true);
    window.addEventListener('pwa-update-available', handleUpdateFound);
    return () => window.removeEventListener('pwa-update-found', handleUpdateFound);
  }, []);

  // FIX 2: Optimized PWA Cache Deletion (Race Condition Fix)
  const applyUpdate = async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name))); // Sequence ensured
      window.location.reload(true);
    }
  };

  const handleLoginSuccess = (userData, token) => {
    localStorage.setItem('chatverse_token', token);
    localStorage.setItem('chatverse_user', JSON.stringify(userData));
    setIsAuthenticated(true);
    navigate('/home');
  };

  // VAPID KEY CONVERTER
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const user = JSON.parse(localStorage.getItem('chatverse_user'));
    
    // ✅ NAYA: Global Socket Connection (Fast websocket mode)
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    setGlobalSocket(socket);
    socket.emit('join', user?.unique_id);

    socket.on('receive_message', (msg) => {
      // ✅ FIX: Jaise hi message aaye, server ko batao taaki sender ko DOUBLE TICK dikhe
      socket.emit('message_delivered', { messageId: msg.id, senderId: msg.sender_id });

      if (window.location.pathname === `/chat/${msg.sender_id}`) return;
      const defaultTone = localStorage.getItem('chatverse_default_tone') || 'ringtone1';
      new Audio(`/sounds/${defaultTone}.mp3`).play().catch(() => {}); 
    });

    // FIX 4: Optimized Push Subscription (No API Spam)
    const setupPushNotification = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          
          if (!sub) {
            const newSub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeZ1TANY_lr2vrQQlQriTAjZ-dLZG2F2gGkQGzS1tW32MvM9gNf0')
            });
            await api.post('/notifications/subscribe', newSub);
          }
        } catch(err) { console.log('Push Setup Failed'); }
      }
    };

    // FIX 5: Memory Leak Clean-up for Permission Listener
    const requestPermissionOnClick = () => {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') setupPushNotification();
        document.removeEventListener('click', requestPermissionOnClick);
      });
    };

    if (Notification.permission === 'granted') setupPushNotification();
    else if (Notification.permission === 'default') {
      document.addEventListener('click', requestPermissionOnClick);
    }

    return () => {
      socketRef.current?.disconnect();
      document.removeEventListener('click', requestPermissionOnClick); // Memory leak fixed
    };
  }, [isAuthenticated]);
  
  if (loading) return <div className="h-[100dvh] w-screen flex items-center justify-center bg-chatverse text-white font-bold text-xl tracking-widest animate-pulse">CHATVERSE</div>;
  if (isAuthenticated && isAppLocked) return <AppLockScreen onUnlock={() => setIsAppLocked(false)} />;
  if (!isAuthenticated) return <AuthScreen onLogin={handleLoginSuccess} />; 

  return (
    <div className="h-[100dvh] w-screen overflow-hidden overscroll-none bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-[#121212] dark:to-black flex justify-center items-center sm:p-6 transition-colors duration-300">
      <div className="flex-1 w-full h-full sm:max-w-[400px] sm:max-h-[850px] sm:rounded-[45px] sm:shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:sm:shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm:border-[12px] sm:border-gray-900 dark:sm:border-gray-800 overflow-hidden flex flex-col relative bg-[#f4f6f8] dark:bg-gray-900 transition-colors duration-300 ring-1 ring-black/5 dark:ring-white/10">

        {isOffline && (
          <div className="absolute top-0 left-0 w-full bg-red-500/95 backdrop-blur-sm text-white text-[12px] font-bold py-1.5 flex justify-center items-center gap-2 z-[9999] shadow-md">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div> Waiting for network...
          </div>
        )}

        {updateAvailable && (
          <div className="fixed top-0 left-0 w-full bg-chatverse text-white px-4 py-3 z-[9999] flex justify-between items-center shadow-lg">
            <div className="flex flex-col">
              <span className="font-bold text-[14px]">🚀 New Update Available!</span>
            </div>
            <button onClick={applyUpdate} className="bg-white text-chatverse px-4 py-2 rounded-full text-[13px] font-black shadow-sm">Update Now</button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/home" element={<HomeFeed />} />
          <Route path="/chats" element={<ChatList socket={globalSocket} />} />
          <Route path="/chat/:id" element={<ChatScreen socket={globalSocket} />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/blocked" element={<BlockedUsers />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;