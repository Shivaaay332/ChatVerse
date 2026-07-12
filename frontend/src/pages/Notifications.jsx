import { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, Bell, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../api';

export default function Notifications() {
  const navigate = useNavigate();
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/friends/requests');
      setFriendRequests(res.data);
    } catch (error) { console.error("Error requests"); } 
    finally { setLoading(false); }
  };

  const handleAccept = async (id) => {
    try {
      await api.put(`/friends/accept/${id}`);
      setFriendRequests(prev => prev.filter(req => req.id !== id));
    } catch (error) { alert("Error accepting request"); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/friends/reject/${id}`);
      setFriendRequests(prev => prev.filter(req => req.id !== id));
    } catch (error) { alert("Error deleting request"); }
  };

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors">
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 py-4 shadow-sm flex items-center gap-4 z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Alerts</h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-24 px-4">
        <h2 className="text-[12px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-2">Friend Requests</h2>

        {loading ? (
           <div className="flex justify-center py-10"><Loader className="w-6 h-6 text-chatverse animate-spin" /></div>
        ) : friendRequests.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 py-16 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3 shadow-inner">
              <Bell className="w-7 h-7 text-gray-300 dark:text-gray-500" />
            </div>
            <p className="font-bold text-gray-900 dark:text-white text-[16px]">No new notifications</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 font-medium">You are all caught up!</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 overflow-hidden">
            {friendRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-gradient-to-tr from-chatverse to-purple-500 rounded-full p-[2px] shadow-sm">
                     <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center font-bold text-chatverse dark:text-indigo-400 text-[16px] uppercase">
                       {req.username.charAt(0)}
                     </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-[14.5px]">{req.username}</h3>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">@{req.unique_id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleAccept(req.id)} className="w-10 h-10 bg-chatverse text-white rounded-full flex items-center justify-center hover:bg-indigo-700 hover:scale-105 transition-all shadow-md">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(req.id)} className="w-10 h-10 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}