import { useState, useEffect } from 'react';
import { Search, UserPlus, Loader, MessageSquare, ChevronRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import BottomNav from '../components/BottomNav';
import api from '../api';
import { SOCKET_URL } from '../api';

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString.endsWith('Z') ? dateString : `${dateString}Z`);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  if (isToday) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } else {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
};

export default function ChatList() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || { unique_id: '' };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRecentChats = async () => {
    try {
      const res = await api.get('/chats/recent');
      setRecentChats(res.data);
    } catch(err) { console.error(err); }
  };

  useEffect(() => {
    fetchRecentChats();
    
    // Live Socket Connection so chat list updates immediately without refresh
    const newSocket = io(SOCKET_URL);
    newSocket.emit('join', currentUser.unique_id);

    newSocket.on('receive_message', () => {
      fetchRecentChats(); // Silently refetch to update count and last message preview
    });
    
    newSocket.on('message_updated', () => {
      fetchRecentChats(); // Refetch if message is deleted or read status changed
    });

    return () => newSocket.disconnect();
  }, [currentUser.unique_id]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setLoading(true);
        try {
          const res = await api.get(`/users/search?query=${searchQuery}`);
          setSearchResults(res.data);
        } catch (error) {} finally { setLoading(false); }
      } else { setSearchResults([]); }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Real-Time Favorite sorting system (Puts marked users at the absolute top)
  const getProcessedChats = () => {
    return [...recentChats].sort((a, b) => {
      const isAFav = localStorage.getItem(`cv_fav_${a.unique_id}`) === 'true';
      const isBFav = localStorage.getItem(`cv_fav_${b.unique_id}`) === 'true';
      if (isAFav && !isBFav) return -1;
      if (!isAFav && isBFav) return 1;
      return 0; // The SQL already sorted them by date, so if neither or both are pinned, date sorting stays
    });
  };

  const processedChats = getProcessedChats();

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors">
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 pt-8 pb-4 z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Messages</h1>
          <button className="text-chatverse dark:text-indigo-400 bg-indigo-50 dark:bg-gray-700 p-2.5 rounded-full hover:bg-chatverse hover:text-white dark:hover:bg-indigo-500 transition-all shadow-sm">
            <UserPlus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input 
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Unique ID..." 
            className="w-full pl-12 pr-4 py-3.5 bg-gray-100/80 dark:bg-gray-700 dark:text-white border border-transparent rounded-[20px] text-[15px] font-medium focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-gray-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-2">
        {loading ? (
           <div className="flex justify-center py-10"><Loader className="w-6 h-6 text-chatverse animate-spin" /></div>
        ) : searchQuery.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 mx-4 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 overflow-hidden mt-2">
             <div className="px-5 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">Search Results</div>
             {searchResults.length > 0 ? searchResults.map((user) => (
              <div key={user.unique_id} onClick={() => navigate(`/user/${user.unique_id}`, { state: { user } })} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg uppercase shadow-sm">{user.username.charAt(0)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-gray-900 dark:text-white text-[15px]">{user.username}</h3>
                    {localStorage.getItem(`cv_fav_${user.unique_id}`) === 'true' && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
                  </div>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">@{user.unique_id}</p>
                </div>
                <ChevronRight className="text-gray-300 dark:text-gray-500 w-5 h-5" />
              </div>
            )) : <div className="text-center py-8 text-gray-400 dark:text-gray-500 font-medium text-[14px]">No users found.</div>}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 mx-4 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 mt-2 overflow-hidden">
            {processedChats.length > 0 ? processedChats.map((user) => {
              const hasStar = localStorage.getItem(`cv_fav_${user.unique_id}`) === 'true';
              const isUnread = Number(user.unread_count) > 0;
              
              // Formatting the preview of the last message beautifully
              let previewText = user.last_message || "Tap to open chat";
              if (user.is_deleted_for_me) {
                 previewText = "Tap to open chat";
              } else if (user.is_deleted_for_everyone) {
                 previewText = "🚫 This message was deleted";
              } else {
                 if (user.sender_id === currentUser.unique_id) previewText = `You: ${previewText}`;
                 if (user.reaction) previewText = `${previewText} ${user.reaction}`;
              }

              return (
                <div key={user.unique_id} onClick={() => navigate(`/chat/${user.unique_id}`, { state: { name: user.username, id: user.unique_id } })} className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 ${hasStar ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}>
                  
                  <div className="w-13 h-13 shrink-0 relative">
                    <div className="w-12 h-12 bg-gradient-to-tr from-chatverse to-purple-500 p-[2px] rounded-full shadow-sm">
                      <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-chatverse dark:text-indigo-400 font-bold text-lg uppercase">{user.username.charAt(0)}</div>
                    </div>
                    {hasStar && (
                      <div className="absolute -bottom-1 right-0 bg-yellow-400 p-[3px] rounded-full border border-white dark:border-gray-800">
                        <Star className="w-[10px] h-[10px] text-white fill-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                         <h3 className={`text-[15px] truncate ${isUnread ? 'font-black text-gray-900 dark:text-white' : 'font-bold text-gray-900 dark:text-gray-100'}`}>{user.username}</h3>
                         {hasStar && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-[4px] leading-none tracking-wide">PINNED</span>}
                      </div>
                      <span className={`text-[11.5px] whitespace-nowrap ${isUnread ? 'font-bold text-chatverse dark:text-indigo-400' : 'font-medium text-gray-400 dark:text-gray-500'}`}>
                         {formatTime(user.last_message_time)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-[13.5px] truncate max-w-[210px] ${isUnread ? 'font-bold text-gray-800 dark:text-gray-200' : 'font-medium text-gray-500 dark:text-gray-400'}`}>
                        {previewText}
                      </p>
                      
                      {/* Premium Unread Counter Badge */}
                      {isUnread && (
                        <div className="w-[20px] h-[20px] bg-chatverse text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-sm shrink-0 mt-0.5">
                          {user.unread_count > 9 ? '9+' : user.unread_count}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3"><MessageSquare className="w-7 h-7 text-gray-300 dark:text-gray-500" /></div>
                <h3 className="text-gray-700 dark:text-gray-300 font-bold text-[16px] mb-1">No chats yet</h3>
                <p className="text-[13px] text-gray-500 font-medium">Search for friends to start.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}