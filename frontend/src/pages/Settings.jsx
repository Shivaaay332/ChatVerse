import { useState, useEffect } from 'react';
import { ArrowLeft, Sun, Moon, Lock, EyeOff, LogOut, UserX, ChevronRight, Shield, Delete, X, CheckCheck } from 'lucide-react';
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

  // Settings States (Synced with LocalStorage)
  const [darkMode, setDarkMode] = useState(localStorage.getItem('chatverse_darkmode') === 'true');
  const [appLock, setAppLock] = useState(localStorage.getItem('chatverse_applock') === 'true');
  const [hideLastSeen, setHideLastSeen] = useState(localStorage.getItem('chatverse_hide_lastseen') === 'true');
  const [hideReadReceipts, setHideReadReceipts] = useState(localStorage.getItem('chatverse_hide_readreceipts') === 'true');

  // PIN Setup States
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStep, setPinStep] = useState(1); // 1 = Enter new PIN, 2 = Confirm PIN
  const [tempPin, setTempPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // --- STANDARD TOGGLES ---
  const handleDarkModeToggle = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem('chatverse_darkmode', newVal);
    if (newVal) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
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
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem('chatverse_token');
      localStorage.removeItem('chatverse_user');
      navigate('/');
      window.location.reload(); 
    }
  };

  // --- APP LOCK & PIN LOGIC ---
  const handleAppLockClick = () => {
    if (appLock) {
      // Turn OFF App Lock instantly
      if(window.confirm("Do you want to disable the App Lock?")) {
        setAppLock(false);
        localStorage.setItem('chatverse_applock', 'false');
        localStorage.removeItem('chatverse_pin');
      }
    } else {
      // Turn ON App Lock -> Open PIN Setup
      setShowPinSetup(true);
      setPinStep(1);
      setTempPin('');
      setConfirmPin('');
      setPinError(false);
    }
  };

  const handleKeyPress = (num) => {
    setPinError(false);
    if (pinStep === 1) {
      if (tempPin.length < 4) {
        setTempPin(prev => prev + num);
      }
    } else {
      if (confirmPin.length < 4) {
        setConfirmPin(prev => prev + num);
      }
    }
  };

  const handleDelete = () => {
    setPinError(false);
    if (pinStep === 1) {
      setTempPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  // Check PIN logic when 4 digits are entered
  useEffect(() => {
    if (pinStep === 1 && tempPin.length === 4) {
      setTimeout(() => setPinStep(2), 200); // Move to confirm step
    }

    if (pinStep === 2 && confirmPin.length === 4) {
      if (tempPin === confirmPin) {
        // Success: PIN Matched -> Save and enable lock
        localStorage.setItem('chatverse_pin', confirmPin);
        localStorage.setItem('chatverse_applock', 'true');
        setAppLock(true);
        setTimeout(() => setShowPinSetup(false), 300);
      } else {
        // Error: PIN Mismatch -> Show error and reset confirm pin
        setPinError(true);
        setTimeout(() => setConfirmPin(''), 500);
      }
    }
  }, [tempPin, confirmPin, pinStep]);

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors">
      
      {/* Header */}
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 py-4 z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft className="w-[22px] h-[22px]" />
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-4 px-3 space-y-6">
        
        {/* APPEARANCE */}
        <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/30">
            <h2 className="text-[12px] font-black text-chatverse uppercase tracking-wider">Appearance</h2>
          </div>
          <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center gap-3.5">
              {darkMode ? <Moon className="w-[22px] h-[22px] text-chatverse dark:text-indigo-400" /> : <Sun className="w-[22px] h-[22px] text-chatverse" />}
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Dark Mode</span>
            </div>
            <ToggleSwitch isOn={darkMode} onToggle={handleDarkModeToggle} />
          </div>
        </div>

        {/* SECURITY & PRIVACY */}
        <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/30">
            <h2 className="text-[12px] font-black text-chatverse uppercase tracking-wider">Privacy & Security</h2>
          </div>
          
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center gap-3.5">
              <Shield className="w-[22px] h-[22px] text-gray-500 dark:text-gray-400" />
              <div className="flex flex-col">
                 <span className="text-[15px] font-bold text-gray-900 dark:text-white">App Lock</span>
                 <span className="text-[11.5px] font-medium text-gray-500">Require PIN to open app</span>
              </div>
            </div>
            <ToggleSwitch isOn={appLock} onToggle={handleAppLockClick} />
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center gap-3.5">
              <EyeOff className="w-[22px] h-[22px] text-gray-500 dark:text-gray-400" />
              <div className="flex flex-col">
                 <span className="text-[15px] font-bold text-gray-900 dark:text-white">Hide Last Seen</span>
                 <span className="text-[11.5px] font-medium text-gray-500">Don't show online status</span>
              </div>
            </div>
            <ToggleSwitch isOn={hideLastSeen} onToggle={handleLastSeenToggle} />
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center gap-3.5">
              <CheckCheck className="w-[22px] h-[22px] text-gray-500 dark:text-gray-400" />
              <div className="flex flex-col">
                 <span className="text-[15px] font-bold text-gray-900 dark:text-white">Read Receipts</span>
                 <span className="text-[11.5px] font-medium text-gray-500">Disable blue ticks for messages</span>
              </div>
            </div>
            <ToggleSwitch isOn={hideReadReceipts} onToggle={handleReadReceiptsToggle} />
          </div>

          {/* Blocked Users Clickable Row */}
          <div onClick={() => navigate('/blocked')} className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
            <div className="flex items-center gap-3.5">
              <UserX className="w-[22px] h-[22px] text-red-500" />
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Blocked Users</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </div>
        </div>

        {/* LOGOUT */}
        <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 overflow-hidden mt-6">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 text-[15px] font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-[20px] h-[20px]" /> Log Out
          </button>
        </div>
      </div>

      <BottomNav />

      {/* ========================================================
          FULL SCREEN PIN SETUP MODAL (WHATSAPP/GPAY STYLE)
          ======================================================== */}
      {showPinSetup && (
        <div className="absolute inset-0 z-[100] bg-chatverse flex flex-col items-center justify-between py-12 px-6 animate-slide-up">
          
          <button onClick={() => setShowPinSetup(false)} className="absolute top-6 left-6 text-white/80 hover:text-white p-2">
             <X className="w-7 h-7" />
          </button>

          <div className="flex flex-col items-center mt-12 w-full">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2 tracking-wide">
              {pinStep === 1 ? "Set App PIN" : "Confirm PIN"}
            </h2>
            <p className="text-indigo-100 text-[14px] font-medium opacity-90 mb-8">
              {pinStep === 1 ? "Enter a 4-digit security PIN" : "Enter the PIN again to confirm"}
            </p>

            {/* PIN Indicator Dots */}
            <div className={`flex gap-4 mb-4 ${pinError ? 'animate-bounce' : ''}`}>
              {[0, 1, 2, 3].map((i) => {
                 const currentLength = pinStep === 1 ? tempPin.length : confirmPin.length;
                 return (
                   <div 
                     key={i} 
                     className={`w-4 h-4 rounded-full transition-all duration-300 ${
                       i < currentLength ? 'bg-white scale-110 shadow-md' : 'bg-white/30'
                     } ${pinError ? 'bg-red-400' : ''}`}
                   />
                 );
              })}
            </div>
            {pinError && <p className="text-red-300 text-[13px] font-bold mt-3">PIN does not match. Try again.</p>}
          </div>

          {/* Premium Numpad */}
          <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-6 gap-x-8 mb-10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button 
                key={num}
                onClick={() => handleKeyPress(num.toString())}
                className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-3xl text-white font-medium hover:bg-white/10 active:bg-white/20 transition-all mx-auto"
              >
                {num}
              </button>
            ))}
            
            <div className="w-[70px] h-[70px] mx-auto"></div> 

            <button 
              onClick={() => handleKeyPress('0')}
              className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-3xl text-white font-medium hover:bg-white/10 active:bg-white/20 transition-all mx-auto"
            >
              0
            </button>
            
            <button 
              onClick={handleDelete}
              className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-all mx-auto"
            >
              <Delete className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}