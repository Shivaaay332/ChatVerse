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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // APP INITIALIZATION & GLOBAL DARK MODE
  // ==========================================
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

  const handleLoginSuccess = (userData, token) => {
    localStorage.setItem('chatverse_token', token);
    localStorage.setItem('chatverse_user', JSON.stringify(userData));
    setIsAuthenticated(true);
    navigate('/home');
  };

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
    <div className="h-[100dvh] w-screen overflow-hidden overscroll-none bg-[#e5e5e5] dark:bg-black flex justify-center sm:py-6 transition-colors duration-300">
      <div className="flex-1 w-full h-full sm:max-w-[400px] sm:h-[90vh] sm:rounded-[40px] sm:shadow-2xl sm:border-[8px] sm:border-gray-900 overflow-hidden flex flex-col relative bg-white dark:bg-gray-900 transition-colors duration-300">
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