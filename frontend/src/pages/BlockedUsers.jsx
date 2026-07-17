import { useState, useEffect } from 'react';
import { ArrowLeft, UserX, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function BlockedUsers() {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(null); // FIX 2: Action Spam rokne ke liye state
  const isMountedRef = useRef(true); // FIX 5: Memory leak rokne ke liye Ref

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchBlockedUsers = async () => {
      try {
        const res = await api.get('/users/blocked');
        if (isMountedRef.current) setBlockedUsers(res.data);
      } catch (error) {
        console.error("Error fetching blocked users");
      } finally {
        if (isMountedRef.current) setLoading(false); // FIX 3: Safe loading false
      }
    };

    fetchBlockedUsers();

    return () => { isMountedRef.current = false; };
  }, []);

  const handleUnblock = async (blockedId) => {
    if (actionLoading) return; // FIX 2: API Spam prevention

    setActionLoading(blockedId);
    
    // FIX 4: Optimistic rollback ki jagah actual network resolve hone ka wait karenge
    try {
      await api.delete(`/users/unblock/${blockedId}`);
      if (isMountedRef.current) {
        setBlockedUsers(prev => prev.filter(u => u.blocked_id !== blockedId));
      }
      
      // FIX 1: The "Ghost Block" Desync - Ye event poori app (Home, Chats) me user ko unblock kar dega
      window.dispatchEvent(new Event('chatverse_settings_updated'));
      
    } catch (err) {
      alert("Error unblocking user. Please try again.");
    } finally {
      if (isMountedRef.current) setActionLoading(null);
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
          <h1 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight leading-none">Blocked Users</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pt-2">
        {loading ? (
          <div className="flex justify-center mt-10"><Loader className="w-6 h-6 text-chatverse animate-spin" /></div>
        ) : blockedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-gray-400">
            <UserX className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
            <p className="font-semibold text-gray-900 dark:text-gray-300">No blocked users</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700">
            {blockedUsers.map(user => (
              <div key={user.blocked_id} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold uppercase">
                    {user.username.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{user.username}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{user.blocked_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleUnblock(user.blocked_id)} 
                  disabled={actionLoading === user.blocked_id}
                  className={`px-4 py-1.5 font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[85px] ${actionLoading === user.blocked_id ? 'bg-gray-50 dark:bg-gray-800 text-gray-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  {actionLoading === user.blocked_id ? <Loader className="w-4 h-4 animate-spin" /> : 'Unblock'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}