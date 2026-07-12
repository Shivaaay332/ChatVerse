import { useState, useEffect } from 'react';
import { ArrowLeft, Sun, Moon, Lock, EyeOff, LogOut, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

// Reusable Custom Toggle Component
const ToggleSwitch = ({ isOn, onToggle }) => (
  <div 
    onClick={onToggle}
    className={`w-[46px] h-[26px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${isOn ? 'bg-chatverse' : 'bg-gray-200 dark:bg-gray-600'}`}
  >
    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
  </div>
);

export default function Settings() {
  const navigate = useNavigate();

  // READ SETTINGS FROM LOCAL STORAGE
  const [darkMode, setDarkMode] = useState(localStorage.getItem('chatverse_darkmode') === 'true');
  const [appLock, setAppLock] = useState(localStorage.getItem('chatverse_applock') === 'true');
  const [hideLastSeen, setHideLastSeen] = useState(localStorage.getItem('chatverse_hide_lastseen') === 'true');
  const [hideReadReceipts, setHideReadReceipts] = useState(localStorage.getItem('chatverse_hide_readreceipts') === 'true');

  // INSTANT DARK MODE TOGGLE
  const handleDarkModeToggle = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem('chatverse_darkmode', newVal);
    
    if (newVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleAppLockToggle = () => {
    const newVal = !appLock;
    setAppLock(newVal);
    localStorage.setItem('chatverse_applock', newVal);
  };

  const handleLastSeenToggle = () => {
    const newVal = !hideLastSeen;
    setHideLastSeen(newVal);
    localStorage.setItem('chatverse_hide_lastseen', newVal);
  };

  const handleReadReceiptsToggle = () => {
    const newVal = !hideReadReceipts;
    setHideReadReceipts(newVal);
    localStorage.setItem('chatverse_hide_readreceipts', newVal);
  };

  const handleLogout = () => {
    if(window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem('chatverse_token');
      localStorage.removeItem('chatverse_user');
      // DO NOT remove settings on logout so they persist for the device
      window.location.href = '/';
    }
  };

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors duration-300">
      
      {/* HEADER */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md px-4 py-3.5 shadow-sm flex items-center gap-4 z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft className="w-[22px] h-[22px]" />
        </button>
        <h1 className="text-[19px] font-black text-gray-900 dark:text-white tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        
        {/* GENERAL SETTINGS */}
        <div className="bg-white dark:bg-gray-800 mt-2 border-y border-gray-100 dark:border-gray-700">
          
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700/50">
            <div className="flex items-center gap-3.5">
              {darkMode ? <Moon className="w-[22px] h-[22px] text-indigo-500" /> : <Sun className="w-[22px] h-[22px] text-chatverse" />}
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Dark Mode</span>
            </div>
            <ToggleSwitch isOn={darkMode} onToggle={handleDarkModeToggle} />
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3.5">
              <Lock className="w-[22px] h-[22px] text-chatverse dark:text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-[15px] font-bold text-gray-900 dark:text-white">App Lock (4-Digit)</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">Required to open ChatVerse</span>
              </div>
            </div>
            <ToggleSwitch isOn={appLock} onToggle={handleAppLockToggle} />
          </div>

        </div>

        {/* PRIVACY SETTINGS */}
        <div className="px-5 pt-6 pb-2">
          <h3 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase">Privacy Settings</h3>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700/50">
            <div className="flex items-center gap-3.5">
              <EyeOff className="w-[22px] h-[22px] text-gray-500 dark:text-gray-400" />
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Hide Last Seen</span>
            </div>
            <ToggleSwitch isOn={hideLastSeen} onToggle={handleLastSeenToggle} />
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700/50">
            <div className="flex items-center gap-3.5">
              <EyeOff className="w-[22px] h-[22px] text-gray-500 dark:text-gray-400" />
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Hide Read Receipts (Blue Tick)</span>
            </div>
            <ToggleSwitch isOn={hideReadReceipts} onToggle={handleReadReceiptsToggle} />
          </div>

          {/* Blocked Users Navigation */}
          <div onClick={() => navigate('/blocked')} className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center gap-3.5">
              <UserX className="w-[22px] h-[22px] text-gray-500 dark:text-gray-400" />
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Blocked Users</span>
            </div>
          </div>
        </div>

        {/* LOGOUT BUTTON */}
        <div className="mt-8 bg-white dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 py-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-bold text-[15px]"
          >
            <LogOut className="w-[20px] h-[20px]" />
            Logout
          </button>
        </div>

      </div>
      
      <BottomNav />
    </div>
  );
}