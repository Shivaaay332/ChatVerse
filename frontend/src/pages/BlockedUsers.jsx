import { useState, useEffect } from 'react';
import { ArrowLeft, UserX, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function BlockedUsers() {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      const res = await api.get('/users/blocked');
      setBlockedUsers(res.data);
    } catch (error) {
      console.error("Error fetching blocked users");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId) => {
    try {
      await api.delete(`/users/unblock/${blockedId}`);
      setBlockedUsers(blockedUsers.filter(u => u.blocked_id !== blockedId));
    } catch (err) {
      alert("Error unblocking user");
    }
  };

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-gray-900 flex flex-col relative transition-colors">
      <div className="bg-white dark:bg-gray-800 px-4 py-3 shadow-sm flex items-center gap-4 z-10 border-b border-gray-100 dark:border-gray-700">
        <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Blocked Users</h1>
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
                <button onClick={() => handleUnblock(user.blocked_id)} className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}