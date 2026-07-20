import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sun, Moon, Lock, EyeOff, LogOut, UserX, ChevronRight, Shield, Delete, X, AlertTriangle, CaseUpper, BadgeCheck, Check, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../api';

// FIX: Added 'disabled' prop to prevent API Spam
const ToggleSwitch = ({ isOn, onToggle, disabled }) => (
  <div 
    onClick={disabled ? null : onToggle} 
    className={`w-[46px] h-[26px] flex items-center rounded-full p-1 transition-colors duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isOn ? 'bg-chatverse' : 'bg-gray-200 dark:bg-gray-600'}`}
  >
    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
  </div>
);

export default function Settings() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || {};
  const isMountedRef = useRef(true);

  const [darkMode, setDarkMode] = useState(localStorage.getItem('chatverse_darkmode') === 'true');
  const [appLock, setAppLock] = useState(localStorage.getItem('chatverse_applock') === 'true');
  const [hideLastSeen, setHideLastSeen] = useState(localStorage.getItem('chatverse_hide_lastseen') === 'true');
  const [hideOnline, setHideOnline] = useState(localStorage.getItem('chatverse_hide_online') === 'true');
  const [hideReadReceipts, setHideReadReceipts] = useState(localStorage.getItem('chatverse_hide_readreceipts') === 'true');
  const [fontSizeIndex, setFontSizeIndex] = useState(parseInt(localStorage.getItem('chatverse_fontsize') || '1'));

  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

  const [showToneModal, setShowToneModal] = useState(false);
  // ✅ FIX 1: Safe check lagaya taaki unsupported browser me app crash na ho
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [previewTone, setPreviewTone] = useState('');
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1);
  const [pinError, setPinError] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // FIX: Safe Initialization & OS Permission Sync
  useEffect(() => {
    isMountedRef.current = true;

    // Check Actual Notification Permissions
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then((status) => {
        if (isMountedRef.current) {
          setPushEnabled(status.state === 'granted');
          status.onchange = () => { if (isMountedRef.current) setPushEnabled(status.state === 'granted'); };
        }
      });
    }

    // Safely sync privacy settings from server to prevent desync
    const fetchPrivacySettings = async () => {
      try {
        const res = await api.get('/users/me/privacy');
        if (isMountedRef.current && res.data) {
          setHideLastSeen(res.data.hide_last_seen);
          setHideOnline(res.data.hide_online_status);
          setHideReadReceipts(res.data.hide_read_receipts);
          
          localStorage.setItem('chatverse_hide_lastseen', res.data.hide_last_seen);
          localStorage.setItem('chatverse_hide_online', res.data.hide_online_status);
          localStorage.setItem('chatverse_hide_readreceipts', res.data.hide_read_receipts);
        }
      } catch (e) { /* Silently fail, fallback to localStorage */ }
    };
    
    fetchPrivacySettings();

    return () => { isMountedRef.current = false; };
  }, []);

  const handleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('chatverse_darkmode', newValue);
    if (newValue) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    // FIX: Global event to update UI uniformly
    window.dispatchEvent(new Event('chatverse_theme_updated'));
  };

  const handleFontSizeChange = (e) => {
    const val = parseInt(e.target.value);
    // ✅ FIX 6: Safety check, agar value array ke bahar ho ya number na ho toh ruk jao
    if (isNaN(val) || val < 0 || val > 2) return; 
    
    setFontSizeIndex(val);
    localStorage.setItem('chatverse_fontsize', val);
    const sizes = ['14px', '16px', '18px'];
    // ✅ FIX 5: Fallback default value di gayi hai
    document.documentElement.style.fontSize = sizes[val] || '16px'; 
  };

  // NEW FIX: Require PIN to disable App Lock
  const handleAppLock = () => {
    if (!appLock) {
      setStep(1); setPin(''); setConfirmPin(''); setPinError(false); setShowPinModal(true);
    } else {
      setStep(3); setPin(''); setPinError(false); setShowPinModal(true); // Ask for current PIN
    }
  };

  // NEW FIX: Strictly Sync LocalStorage with Fallback
  const handleLastSeen = async () => {
    if (isUpdatingPrivacy) return;
    const previousValue = hideLastSeen;
    const newValue = !hideLastSeen;
    
    setIsUpdatingPrivacy(true);
    setHideLastSeen(newValue);
    localStorage.setItem('chatverse_hide_lastseen', newValue); // Set Optimistic
    
    try { 
      await api.put('/users/me/privacy', { hideLastSeen: newValue }); 
    } catch(err) { 
      if (isMountedRef.current) {
        setHideLastSeen(previousValue); 
        localStorage.setItem('chatverse_hide_lastseen', previousValue); // Rollback LS on error
      }
      alert("Failed to update setting. Please try again.");
    } finally {
      if (isMountedRef.current) setIsUpdatingPrivacy(false);
    }
  };

  const handleHideOnline = async () => {
    if (isUpdatingPrivacy) return;
    const previousValue = hideOnline;
    const newValue = !hideOnline;
    
    setIsUpdatingPrivacy(true);
    setHideOnline(newValue);
    localStorage.setItem('chatverse_hide_online', newValue);
    
    try { 
      await api.put('/users/me/privacy', { hideOnlineStatus: newValue }); 
    } catch(err) { 
      if (isMountedRef.current) {
        setHideOnline(previousValue); 
        localStorage.setItem('chatverse_hide_online', previousValue);
      }
      alert("Failed to update setting. Please try again.");
    } finally {
      if (isMountedRef.current) setIsUpdatingPrivacy(false);
    }
  };

  const handleReadReceipts = async () => {
    if (isUpdatingPrivacy) return;
    const previousValue = hideReadReceipts;
    const newValue = !hideReadReceipts;
    
    setIsUpdatingPrivacy(true);
    setHideReadReceipts(newValue);
    localStorage.setItem('chatverse_hide_readreceipts', newValue);
    
    try { 
      await api.put('/users/me/privacy', { hideReadReceipts: newValue }); 
    } catch(err) { 
      if (isMountedRef.current) {
        setHideReadReceipts(previousValue); 
        localStorage.setItem('chatverse_hide_readreceipts', previousValue);
      }
      alert("Failed to update setting. Please try again.");
    } finally {
      if (isMountedRef.current) setIsUpdatingPrivacy(false);
    }
  };


  const handleGetVerified = async () => {
    if (currentUser.is_verified) { alert("You are already verified! ✅"); return; }
    try {
      await api.put('/users/me/verify');
      const updatedUser = { ...currentUser, is_verified: true };
      localStorage.setItem('chatverse_user', JSON.stringify(updatedUser));
      alert("Congratulations! You are now Verified! 🎉");
      window.location.reload(); 
    } catch (err) { alert("Failed to get verified. Please try again."); }
  };

  // NEW FIX: Await Unsubscription and Unregister Service Workers to stop Ghost Notifications
  const handleLogout = async () => {
    try { 
      await api.post('/notifications/unsubscribe'); 
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let reg of regs) { await reg.unregister(); }
      }
    } catch(e) { console.error("Logout cleanup error:", e); }
    
    window.dispatchEvent(new Event('chatverse_logout_trigger'));
    localStorage.clear();
    document.documentElement.style.fontSize = '16px'; 
    navigate('/', { replace: true }); // ✅ FIX 4: React SPA navigation, bina jhatke (refresh) ke page change
  };

  const handleKeyPress = (num) => {
    if (pin.length < 4) { setPin((prev) => prev + num); setPinError(false); }
  };

  const handlePinDelete = () => { setPin((prev) => prev.slice(0, -1)); setPinError(false); };

  // ✅ FIX 2 & 3: timeoutId banaya aur return() me usko clear kiya taaki memory leak aur loop na bane
  useEffect(() => {
    let timeoutId;
    if (pin.length === 4) {
      if (step === 1) {
        timeoutId = setTimeout(() => { if(isMountedRef.current) { setConfirmPin(pin); setPin(''); setStep(2); }}, 300);
      } else if (step === 2) {
        if (pin === confirmPin) {
          localStorage.setItem('chatverse_pin', pin);
          localStorage.setItem('chatverse_applock', 'true');
          setAppLock(true);
          window.dispatchEvent(new Event('chatverse_applock_triggered'));
          timeoutId = setTimeout(() => { if(isMountedRef.current) setShowPinModal(false); }, 300);
        } else {
          setPinError(true);
          timeoutId = setTimeout(() => { 
            if(isMountedRef.current) {
               setPin(''); 
               setStep(1); 
               setConfirmPin('');
            }
          }, 500);
        }
      } else if (step === 3) {
        const currentPin = localStorage.getItem('chatverse_pin');
        if (pin === currentPin) {
          localStorage.removeItem('chatverse_applock');
          localStorage.removeItem('chatverse_pin');
          setAppLock(false);
          timeoutId = setTimeout(() => { if(isMountedRef.current) setShowPinModal(false); }, 300);
        } else {
          setPinError(true);
          timeoutId = setTimeout(() => { if(isMountedRef.current) setPin(''); }, 500);
        }
      }
    }
    // Cleanup function memory ko free karne ke liye
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pin, step, confirmPin]);

  const handleDeleteAccount = async () => {
    if (!deletePassword) { setDeleteError('Password is required'); return; }
    setIsDeleting(true); setDeleteError('');
    try {
      // FIX: The "Ghost Push" Deletion Flaw - Complete cleanup of background workers
      await api.post('/notifications/unsubscribe').catch(() => {});
      
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let reg of regs) { await reg.unregister(); }
      }

      await api.delete('/users/me', { data: { password: deletePassword } });
      
      window.dispatchEvent(new Event('chatverse_logout_trigger'));
      localStorage.clear();
      document.documentElement.style.fontSize = '16px';
      
      navigate('/', { replace: true }); // ✅ FIX 4: React SPA navigation
    } catch (err) {
      if (isMountedRef.current) {
        setDeleteError(err.response?.data?.error || 'Failed to delete account');
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors">
      
      {/* UNIVERSAL HEADER */}
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 z-20 shrink-0 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <ArrowLeft className="w-[22px] h-[22px]" />
          </button>
          <h1 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight leading-none">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar pb-24 px-4 py-4 space-y-6">

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
              <input type="range" min="0" max="2" step="1" value={fontSizeIndex} onChange={handleFontSizeChange} className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-chatverse" />
              <div className="flex justify-between mt-2 px-1 text-[11px] font-bold text-gray-400">
                <span>Small</span><span>Medium</span><span>Large</span>
              </div>
            </div>
          </div>
        </div>

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
            <ToggleSwitch isOn={hideLastSeen} onToggle={handleLastSeen} disabled={isUpdatingPrivacy} />
          </div>

          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                <EyeOff className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 dark:text-white text-[15px]">Hide Online & Typing</span>
                <span className="text-[12px] text-gray-500">Hide live status from others</span>
              </div>
            </div>
            <ToggleSwitch isOn={hideOnline} onToggle={handleHideOnline} disabled={isUpdatingPrivacy} />
          </div>

          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-blue-500 dark:text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-[15px]">Hide Read Receipts</span>
            </div>
            <ToggleSwitch isOn={hideReadReceipts} onToggle={handleReadReceipts} disabled={isUpdatingPrivacy} />
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

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-gray-700 transition-colors">
          <h2 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 pl-1">Notifications & Sound</h2>
          
          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-yellow-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-yellow-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 dark:text-white text-[15px]">Push Popups</span>
                <span className="text-[12px] text-gray-500">Show message popups on screen</span>
              </div>
            </div>
            <button 
              onClick={() => {
                // ✅ FIX 1 (Part 2): Click karne par bhi safe check taaki error na aaye
                if (typeof Notification !== 'undefined') {
                  Notification.requestPermission().then(perm => {
                    setPushEnabled(perm === 'granted');
                    if(perm === 'granted') alert("Popups enabled!");
                  });
                } else {
                  alert("Push notifications are not supported on your browser/device.");
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold ${pushEnabled ? 'bg-green-100 text-green-600' : 'bg-chatverse text-white'}`}
            >
              {pushEnabled ? 'Enabled' : 'Allow'}
            </button>
          </div>

          <div 
            onClick={() => { 
              setPreviewTone(localStorage.getItem('chatverse_default_tone') || 'ringtone1');
              setShowToneModal(true); 
            }} 
            className="flex items-center justify-between py-2 cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-indigo-500">
                <CaseUpper className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 dark:text-white text-[15px]">Default Tone</span>
                <span className="text-[12px] text-gray-500 capitalize">
                   {(localStorage.getItem('chatverse_default_tone') || 'ringtone1').replace('ringtone', 'Tone ')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </div>
        </div>

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

      {showToneModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4" onClick={() => setShowToneModal(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[24px] p-5 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-lg text-gray-900 dark:text-white mb-4">Set Default Tone</h3>
            
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar pb-2 px-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
                const toneId = `ringtone${num}`;
                return (
                  <button 
                    key={toneId} 
                    // NEW FIX: Safely wrap Audio Play to prevent DOM Exceptions crashing React
                    onClick={() => {
                      setPreviewTone(toneId); 
                      try {
                        const audio = new Audio(`/sounds/${toneId}.mp3`);
                        audio.volume = 0.5;
                        const playPromise = audio.play();
                        if (playPromise !== undefined) {
                          playPromise.catch(error => console.warn("Tone preview blocked by browser policy"));
                        }
                      } catch (e) { console.warn("Audio exception:", e); }
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${previewTone === toneId ? 'bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    <span className="font-bold text-[14.5px] text-gray-800 dark:text-gray-100">Tone {num}</span>
                    <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-colors ${previewTone === toneId ? 'border-chatverse' : 'border-gray-300 dark:border-gray-500'}`}>
                      {previewTone === toneId && <div className="w-[10px] h-[10px] bg-chatverse rounded-full" />}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowToneModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 font-bold py-3.5 rounded-xl text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
              <button 
                onClick={() => {
                  localStorage.setItem('chatverse_default_tone', previewTone); 
                  // FIX: Broadcast Tone change to other components globally
                  window.dispatchEvent(new Event('chatverse_settings_updated'));
                  setShowToneModal(false);
                }} 
                className="flex-1 bg-chatverse text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
                {isDeleting ? <Loader className="w-5 h-5 animate-spin" /> : 'Permanently Delete'}
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