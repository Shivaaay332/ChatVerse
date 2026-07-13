import { useState, useEffect } from 'react';
import { ArrowLeft, Sun, Moon, Lock, EyeOff, LogOut, UserX, ChevronRight, Shield, Delete, X, AlertTriangle, CaseUpper, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../api';

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
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || {};

  // Settings States
  const [darkMode, setDarkMode] = useState(localStorage.getItem('chatverse_darkmode') === 'true');
  const [appLock, setAppLock] = useState(localStorage.getItem('chatverse_applock') === 'true');
  const [hideLastSeen, setHideLastSeen] = useState(localStorage.getItem('chatverse_hide_lastseen') === 'true');
  const [hideReadReceipts, setHideReadReceipts] = useState(localStorage.getItem('chatverse_hide_readreceipts') === 'true');
  
  const [fontSizeIndex, setFontSizeIndex] = useState(parseInt(localStorage.getItem('chatverse_fontsize') || '1'));

  // App Lock Setup States
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1);
  const [pinError, setPinError] = useState(false);

  // Delete Account States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Handlers ---
  const handleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('chatverse_darkmode', newValue);
    if (newValue) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleFontSizeChange = (e) => {
    const val = parseInt(e.target.value);
    setFontSizeIndex(val);
    localStorage.setItem('chatverse_fontsize', val);
    const sizes = ['14px', '16px', '18px'];
    document.documentElement.style.fontSize = sizes[val];
  };

  const handleAppLock = () => {
    if (!appLock) {
      setStep(1);
      setPin('');
      setConfirmPin('');
      setPinError(false);
      setShowPinModal(true);
    } else {
      localStorage.removeItem('chatverse_applock');
      localStorage.removeItem('chatverse_pin');
      setAppLock(false);
    }
  };

  const handleLastSeen = () => {
    const newValue = !hideLastSeen;
    setHideLastSeen(newValue);
    localStorage.setItem('chatverse_hide_lastseen', newValue);
  };

  const handleReadReceipts = () => {
    const newValue = !hideReadReceipts;
    setHideReadReceipts(newValue);
    localStorage.setItem('chatverse_hide_readreceipts', newValue);
  };

  // NEW: GET VERIFIED LOGIC
  const handleGetVerified = async () => {
    if (currentUser.is_verified) {
      alert("You are already verified! ✅");
      return;
    }
    try {
      await api.put('/users/me/verify');
      const updatedUser = { ...currentUser, is_verified: true };
      localStorage.setItem('chatverse_user', JSON.stringify(updatedUser));
      alert("Congratulations! You are now Verified! 🎉");
      window.location.reload(); // Reload immediately to show ticks everywhere
    } catch (err) {
      alert("Failed to get verified. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    document.documentElement.style.fontSize = '16px'; 
    navigate('/');
  };

  // --- PIN Numpad Logic ---
  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
      setPinError(false);
    }
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (step === 1) {
        setTimeout(() => {
          setConfirmPin(pin);
          setPin('');
          setStep(2);
        }, 300);
      } else if (step === 2) {
        if (pin === confirmPin) {
          localStorage.setItem('chatverse_pin', pin);
          localStorage.setItem('chatverse_applock', 'true');
          setAppLock(true);
          setTimeout(() => setShowPinModal(false), 300);
        } else {
          setPinError(true);
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  }, [pin, step, confirmPin]);

  // --- Delete Account Logic ---
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Password is required');
      return;
    }
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/users/me', { data: { password: deletePassword } });
      localStorage.clear();
      document.documentElement.style.fontSize = '16px';
      navigate('/');
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors">
      
      {/* Header */}
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 py-4 z-20 shrink-0 border-b border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft className="w-[22px] h-[22px]" />
        </button>
        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar pb-24 px-4 py-4 space-y-6">

        {/* Premium / Verification Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-gray-700 transition-colors">
          <h2 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 pl-1">Premium Features</h2>
          <div onClick={handleGetVerified} className="flex items-center justify-between py-2 cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-[#1d9bf0]">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 dark:text-white text-[15px]">
                  {currentUser.is_verified ? "Verified Account" : "Get Verified Badge"}
                </span>
                <span className="text-[12px] text-gray-500">
                  {currentUser.is_verified ? "You have a premium blue tick" : "Show a blue tick next to your name"}
                </span>
              </div>
            </div>
            {!currentUser.is_verified && <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#1d9bf0] transition-colors" />}
          </div>
        </div>
        
        {/* Appearance Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-gray-700 transition-colors">
          <h2 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 pl-1">Appearance</h2>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-chatverse dark:text-indigo-400">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-[15px]">Dark Mode</span>
            </div>
            <ToggleSwitch isOn={darkMode} onToggle={handleDarkMode} />
          </div>
        </div>

        {/* Accessibility / Font Size Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-gray-700 transition-colors">
          <h2 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 pl-1">Accessibility</h2>
          <div className="py-2">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-10 h-10 bg-purple-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-purple-500 dark:text-purple-400">
                <CaseUpper className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 dark:text-white text-[15px]">Font Size</span>
                <span className="text-[12px] text-gray-500">Adjust the app's text scale</span>
              </div>
            </div>
            
            <div className="px-2">
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="1" 
                value={fontSizeIndex} 
                onChange={handleFontSizeChange}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-chatverse"
              />
              <div className="flex justify-between mt-2 px-1 text-[11px] font-bold text-gray-400">
                <span>Small</span>
                <span>Medium</span>
                <span>Large</span>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-gray-700 transition-colors">
          <h2 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 pl-1">Privacy & Security</h2>
          
          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-green-500 dark:text-green-400">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 dark:text-white text-[15px]">App Lock</span>
                <span className="text-[12px] text-gray-500">Require PIN to open app</span>
              </div>
            </div>
            <ToggleSwitch isOn={appLock} onToggle={handleAppLock} />
          </div>

          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-blue-500 dark:text-blue-400">
                <EyeOff className="w-5 h-5" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-[15px]">Hide Last Seen</span>
            </div>
            <ToggleSwitch isOn={hideLastSeen} onToggle={handleLastSeen} />
          </div>

          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-blue-500 dark:text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-[15px]">Hide Read Receipts</span>
            </div>
            <ToggleSwitch isOn={hideReadReceipts} onToggle={handleReadReceipts} />
          </div>

          <div onClick={() => navigate('/blocked')} className="flex items-center justify-between py-2 cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-red-500 dark:text-red-400">
                <UserX className="w-5 h-5" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-[15px]">Blocked Users</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-gray-700 transition-colors">
           <h2 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-2 pl-1">Danger Zone</h2>
           
           <div onClick={handleLogout} className="flex items-center justify-between py-3 cursor-pointer group border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300">
                <LogOut className="w-5 h-5 ml-1" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-[15px]">Log Out</span>
            </div>
          </div>

          <div onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true); }} className="flex items-center justify-between py-3 pt-4 cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-red-500 text-[15px]">Delete Account</span>
                <span className="text-[12px] text-gray-500">Permanently delete your data</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* --- PIN Setup Modal (Numpad) --- */}
      {showPinModal && (
        <div className="absolute inset-0 bg-chatverse z-50 flex flex-col items-center justify-between py-12 px-6 animate-slide-up">
          <button onClick={() => { setShowPinModal(false); setAppLock(false); }} className="absolute top-6 right-6 p-2 text-white/70 hover:text-white bg-black/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center mt-10">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-6">{step === 1 ? 'Enter new PIN' : 'Confirm new PIN'}</h2>
            <div className="flex gap-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-white scale-110' : 'bg-white/30'} ${pinError ? 'bg-red-400' : ''}`} />
              ))}
            </div>
            {pinError && <p className="text-red-300 text-[13px] font-bold mt-3">PIN does not match. Try again.</p>}
          </div>

          <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-6 gap-x-8 mb-10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button key={num} onClick={() => handleKeyPress(num.toString())} className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-3xl text-white font-medium hover:bg-white/10 active:bg-white/20 transition-all mx-auto">
                {num}
              </button>
            ))}
            <div className="w-[70px] h-[70px] mx-auto"></div> 
            <button onClick={() => handleKeyPress('0')} className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-3xl text-white font-medium hover:bg-white/10 active:bg-white/20 transition-all mx-auto">0</button>
            <button onClick={handlePinDelete} className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-3xl text-white font-medium hover:bg-white/10 active:bg-white/20 transition-all mx-auto"><Delete className="w-8 h-8" /></button>
          </div>
        </div>
      )}

      {/* --- Delete Account Secure Modal --- */}
      {showDeleteModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[24px] p-6 shadow-2xl animate-slide-up border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Delete Account</h2>
              <p className="text-[14px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                This action is irreversible. All your messages, posts, friends, and data will be permanently wiped.
              </p>
            </div>
            
            <div className="mb-6">
              <input 
                type="password" 
                placeholder="Enter your password to confirm" 
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                className="w-full bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:border-red-400 rounded-xl px-4 py-3 text-[15px] outline-none text-gray-900 dark:text-white transition-all"
              />
              {deleteError && <p className="text-red-500 text-[12px] font-bold mt-2 text-center">{deleteError}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteAccount}
                disabled={isDeleting || !deletePassword}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-3.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}