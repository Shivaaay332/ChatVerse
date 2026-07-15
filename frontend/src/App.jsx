import { io } from 'socket.io-client';
import { SOCKET_URL } from './api';
import { useState, useEffect } from 'react';
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
  
  // FIX: Ye line missing thi isliye white screen aa rahi thi
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // APP INITIALIZATION & GLOBAL DARK MODE
  // ==========================================

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
    
    // Apply Dark Mode globally to the HTML tag
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (token) {
      setIsAuthenticated(true);
      if (lockSetting) setIsAppLocked(true);
    }
    setLoading(false);
  }, []);

  // Update detect karne ka effect
  useEffect(() => {
    const handleUpdateFound = () => setUpdateAvailable(true);
    window.addEventListener('pwa-update-available', handleUpdateFound);
    return () => window.removeEventListener('pwa-update-available', handleUpdateFound);
  }, []);

  // Update apply karne ka function
  const applyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          // Naye worker ko bolo ab app ka control le le
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
      // Purane saare kachre (Cache) ko permanently delete karo
      caches.keys().then((names) => {
        for (let name of names) caches.delete(name);
      });
      // 0.5 sec baad app ko hard refresh kar do
      setTimeout(() => window.location.reload(true), 500);
    }
  };

  const handleLoginSuccess = (userData, token) => {
    localStorage.setItem('chatverse_token', token);
    localStorage.setItem('chatverse_user', JSON.stringify(userData));
    setIsAuthenticated(true);
    navigate('/home');
  };

  // Helper for Push Subscriptions
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  };

  // Main Authentication & Push Setup (100% FIX)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const user = JSON.parse(localStorage.getItem('chatverse_user'));
    const globalSocket = io(SOCKET_URL);
    globalSocket.emit('join', user?.unique_id);

    // 1. IN-APP SOUND & POPUP (Jab tum app me kisi bhi page par ho)
    globalSocket.on('receive_message', (msg) => {
      // Agar current chat me ho to notification mat do
      if (window.location.pathname === `/chat/${msg.sender_id}`) return;
      
      const defaultTone = localStorage.getItem('chatverse_default_tone') || 'ringtone1';
      try { new Audio(`/sounds/${defaultTone}.mp3`).play(); } catch (e) {}

      // Kisi bhi aur page par hone par screen par popup dikhayega
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(msg.username || "New Message", {
            body: msg.content || "Sent you a message",
            icon: "/logo.png",
            badge: "/logo.png",
            vibrate: [200, 100, 200],
            requireInteraction: true,
            data: { url: `/chat/${msg.sender_id}` }
          });
        });
      }
    });

    // 2. FORCE RE-SUBSCRIBE WEB PUSH (Yahi hai Double Tick & Background Popup ka secret)
    const subscribeUserToPush = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          
          // FIX: Purana kharab token hatao (Unsubscribe)
          let oldSubscription = await registration.pushManager.getSubscription();
          if (oldSubscription) {
            await oldSubscription.unsubscribe();
          }
          
          // FIX: Naya fresh token generate karo
          const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeZ1TANY_lr2vrQQlQriTAjZ-dLZG2F2gGkQGzS1tW32MvM9gNf0';
          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
          });
          
          // Backend ko ye fresh token do, jisse Push kabhi fail na ho!
          await api.post('/notifications/subscribe', newSubscription);
        } catch(err) { console.log('Push setup failed:', err); }
      }
    };

    if (Notification.permission === 'granted') {
       subscribeUserToPush();
    } else {
       Notification.requestPermission().then(perm => {
         if(perm === 'granted') subscribeUserToPush();
       });
    }

    return () => globalSocket.disconnect();
  }, [isAuthenticated]);

  
  if (loading) {
    return <div className="h-[100dvh] w-screen flex items-center justify-center bg-chatverse text-white font-bold text-xl tracking-widest animate-pulse">CHATVERSE</div>;
  }

  if (isAuthenticated && isAppLocked) {
    return <AppLockScreen onUnlock={() => setIsAppLocked(false)} />;
  }

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLoginSuccess} />; 
  }

  return (
    // Outer Background - Blurred abstract gradient for Desktop
    <div className="h-[100dvh] w-screen overflow-hidden overscroll-none bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-[#121212] dark:to-black flex justify-center items-center sm:p-6 transition-colors duration-300">
      
      {/* Mobile Device Mockup Container for Desktop (Notch removed for clean view) */}
      <div className="flex-1 w-full h-full sm:max-w-[400px] sm:max-h-[850px] sm:rounded-[45px] sm:shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:sm:shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm:border-[12px] sm:border-gray-900 dark:sm:border-gray-800 overflow-hidden flex flex-col relative bg-[#f4f6f8] dark:bg-gray-900 transition-colors duration-300 ring-1 ring-black/5 dark:ring-white/10">

        {/* OFFLINE BANNER UI */}
        {isOffline && (
          <div className="absolute top-0 left-0 w-full bg-red-500/95 backdrop-blur-sm text-white text-[12px] font-bold py-1.5 flex justify-center items-center gap-2 z-[9999] shadow-md transition-all duration-300">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Waiting for network...
          </div>
        )}

        {/* 🚀 UPDATE BANNER */}
        {updateAvailable && (
          <div className="fixed top-0 left-0 w-full bg-chatverse text-white px-4 py-3 z-[9999] flex justify-between items-center shadow-lg animate-slide-down">
            <div className="flex flex-col">
              <span className="font-bold text-[14px]">🚀 New Update Available!</span>
              <span className="text-[11px] text-indigo-100">Get the latest features & bug fixes.</span>
            </div>
            <button 
              onClick={applyUpdate} 
              className="bg-white text-chatverse px-4 py-2 rounded-full text-[13px] font-black shadow-sm hover:scale-105 active:scale-95 transition-all"
            >
              Update Now
            </button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/home" element={<HomeFeed />} />
          <Route path="/chats" element={<ChatList />} />
          <Route path="/chat/:id" element={<ChatScreen />} />
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