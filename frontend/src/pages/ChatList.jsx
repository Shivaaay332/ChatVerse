import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader, MessageSquare, ChevronRight, Star, ArrowLeft, BadgeCheck, Trash2, UserPlus } from 'lucide-react';
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

export default function ChatList({ socket }) { // ✅ NAYA: App.jsx se socket liya
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || { unique_id: '' };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // NEW FIX: Cache Keys mapped to specific User ID to prevent Privacy Leaks
  const [recentChats, setRecentChats] = useState(() => {
    const cached = localStorage.getItem(`chatverse_cached_recentChats_${currentUser.unique_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  
  const [friendsList, setFriendsList] = useState(() => {
    const cached = localStorage.getItem(`chatverse_cached_friendsList_${currentUser.unique_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  
  const [loading, setLoading] = useState(recentChats.length === 0);
  const searchInputRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeouts = useRef({});
  
  // Naye Refs (Fixes ke liye)
  const fetchTimeoutRef = useRef(null);
  const deletedChatsRef = useRef(new Set());
  const swipeStartRef = useRef({ x: 0, y: 0, pointerId: null });
  const isMountedRef = useRef(true);

  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [longPressedChat, setLongPressedChat] = useState(null);
  const pressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  // Safe Mount Tracker
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchChatsAndFriends = async () => {
    try {
      const chatRes = await api.get('/chats/recent');
      if (isMountedRef.current) {
        setRecentChats(chatRes.data);
        // NEW FIX: Save with Unique ID
        localStorage.setItem(`chatverse_cached_recentChats_${currentUser.unique_id}`, JSON.stringify(chatRes.data)); 
      }
      
      const friendRes = await api.get('/friends');
      if (isMountedRef.current) {
        setFriendsList(friendRes.data);
        // NEW FIX: Save with Unique ID
        localStorage.setItem(`chatverse_cached_friendsList_${currentUser.unique_id}`, JSON.stringify(friendRes.data)); 
        setLoading(false);
      }
    } catch (err) {
      console.log("Failed to fetch data:", err);
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatsAndFriends();

    const syncOnFocusOrUpdate = () => {
      if (isMountedRef.current) fetchChatsAndFriends();
    };
    window.addEventListener('focus', syncOnFocusOrUpdate);
    window.addEventListener('chatverse_settings_updated', syncOnFocusOrUpdate);
    window.addEventListener('chatverse_chat_read', syncOnFocusOrUpdate);

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'], 
      reconnectionAttempts: 5
    });
    
    newSocket.emit('join', currentUser.unique_id);

    newSocket.on('connect', () => {
      newSocket.emit('sync_messages', currentUser.unique_id);
    });

    newSocket.on('sync_complete', (syncedChats) => {
      if (!isMountedRef.current) return;
      setRecentChats(syncedChats.filter(c => !deletedChatsRef.current.has(c.unique_id)));
    });

    newSocket.on('receive_message', (message) => {
      if (!isMountedRef.current) return;

      const senderId = message?.sender_id;

      if (senderId) {
        setTypingUsers(prev => ({ ...prev, [senderId]: false }));
        if (typingTimeouts.current[senderId]) {
          clearTimeout(typingTimeouts.current[senderId]);
        }
      }

      if (senderId || message?.receiver_id) {
        setRecentChats(prevChats => {
          const chatIndex = prevChats.findIndex(c => 
            c.unique_id === senderId || c.unique_id === message.receiver_id
          );

          if (chatIndex > -1) {
            const updatedChat = { 
              ...prevChats[chatIndex], 
              last_message: message.text || message.content || "📷 Attachment",
              last_message_time: new Date().toISOString(),
              unread_count: senderId !== currentUser.unique_id 
                            ? Number(prevChats[chatIndex].unread_count || 0) + 1 
                            : 0
            };
            const newChats = [...prevChats];
            newChats.splice(chatIndex, 1);
            newChats.unshift(updatedChat); 
            return newChats;
          } else {
            // NEW FIX: Agar completely NAYA user message kare, SIRF TABHI backend ko hit karo
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            fetchTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) fetchChatsAndFriends();
            }, 1000);
            return prevChats;
          }
        });
      }
      
      // Removed the brutal fetchTimeoutRef from here completely to prevent DDoS
    });

    newSocket.on('message_updated', () => {
      // FIX: Sirf UI refresh ke liye trigger karo agar status check zaroori ho, 
      // otherwise hum is API call ko remove kar rahe hain taaki DB safe rahe.
    });

    newSocket.on('typing', (senderId) => {
      if (!isMountedRef.current) return;
      setTypingUsers(prev => ({ ...prev, [senderId]: true }));
      if (typingTimeouts.current[senderId]) clearTimeout(typingTimeouts.current[senderId]);
      
      typingTimeouts.current[senderId] = setTimeout(() => {
        if (isMountedRef.current) setTypingUsers(prev => ({ ...prev, [senderId]: false }));
      }, 2500);
    });

    return () => {
      window.removeEventListener('focus', syncOnFocusOrUpdate);
      window.removeEventListener('chatverse_settings_updated', syncOnFocusOrUpdate);
      window.removeEventListener('chatverse_chat_read', syncOnFocusOrUpdate);

      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      Object.values(typingTimeouts.current).forEach(clearTimeout); 
      newSocket.disconnect();
    };
  }, [currentUser.unique_id]);

  // Yeh missing ho gaya tha! (Search logic)
  // NEW FIX: Memory leak protection in Search
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        if (isMountedRef.current) setLoading(true);
        try {
          const res = await api.get(`/users/search?query=${searchQuery}`);
          if (isMountedRef.current) setSearchResults(res.data);
        } catch (error) {} finally { 
          if (isMountedRef.current) setLoading(false); 
        }
      } else { 
        if (isMountedRef.current) setSearchResults([]); 
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Yeh sab handlers missing ho gaye the!
  const handlePointerDown = (e, chat) => {
    longPressTriggered.current = false;
    swipeStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setLongPressedChat(chat);
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
    }, 500); 
  };

  const handlePointerMove = (e) => {
    if (e.pointerId !== swipeStartRef.current.pointerId) return;
    const dx = Math.abs(e.clientX - swipeStartRef.current.x);
    const dy = Math.abs(e.clientY - swipeStartRef.current.y);
    if ((dx > 10 || dy > 10) && pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handlePointerUpOrLeave = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleChatClick = (e, chat) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return; 
    }
    navigate(`/chat/${chat.unique_id}`, { state: { name: chat.username, id: chat.unique_id } });
  };

  const confirmDeleteChat = async () => {
    if (!longPressedChat) return;
    const chatId = longPressedChat.unique_id;
    deletedChatsRef.current.add(chatId); 
    
    setRecentChats(prev => prev.filter(chat => chat.unique_id !== chatId));
    setLongPressedChat(null);
    
    try {
      await api.delete(`/chats/${chatId}`);
    } catch (err) {
      deletedChatsRef.current.delete(chatId); 
      fetchChatsAndFriends();
      alert("Failed to delete chat.");
    }
  };

  // Error ki vajah yehi thi - ye function udd gaya tha!
  const processedChats = useMemo(() => {
    const favSet = new Set();
    recentChats.forEach(chat => {
      if (localStorage.getItem(`cv_fav_${chat.unique_id}`) === 'true') favSet.add(chat.unique_id);
    });

    return [...recentChats].sort((a, b) => {
      const isAFav = favSet.has(a.unique_id);
      const isBFav = favSet.has(b.unique_id);
      if (isAFav && !isBFav) return -1;
      if (!isAFav && isBFav) return 1;
      
      const timeA = new Date(a.last_message_time || 0).getTime();
      const timeB = new Date(b.last_message_time || 0).getTime();
      return timeB - timeA;
    });
  }, [recentChats]);

  // Yahan se niche aapka return ( ...) statement start hoga

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col overflow-hidden relative transition-colors">
      
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl pt-[calc(env(safe-area-inset-top)+16px)] pb-3 z-20 shrink-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-6 px-4">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Messages</h1>
        </div>
        <div className="relative px-4">
          <Search className="absolute left-8 top-3.5 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input 
            ref={searchInputRef}
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Unique ID..." 
            className="w-full pl-12 pr-4 py-3.5 bg-gray-100/80 dark:bg-gray-700 dark:text-white border border-transparent rounded-[20px] text-[15px] font-medium focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-gray-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar pb-24 pt-2">
        {loading ? (
           <div className="flex flex-col gap-5 px-5 py-4 mt-2">
             {[1, 2, 3, 4, 5, 6].map((i) => (
               <div key={i} className="flex items-center gap-4 animate-pulse">
                 <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                 <div className="flex-1 flex flex-col gap-2.5">
                   <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                   <div className="w-48 h-2 bg-gray-100 dark:bg-gray-600 rounded-full"></div>
                 </div>
               </div>
             ))}
           </div>
        ) : searchQuery.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 mx-4 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 overflow-hidden mt-2">
             <div className="px-5 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">Search Results</div>
             {searchResults.length > 0 ? searchResults.map((user) => (
                <div key={user.unique_id} onClick={() => navigate(`/user/${user.unique_id}`, { state: { user } })} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg uppercase shadow-sm">{user.username.charAt(0)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-gray-900 dark:text-white text-[16px] flex items-center">
                        {user.username}
                        {user.is_verified && <BadgeCheck className="w-[15px] h-[15px] text-[#1d9bf0] ml-1 shrink-0" />}
                      </h3>
                      {localStorage.getItem(`cv_fav_${user.unique_id}`) === 'true' && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
                    </div>
                    <p className="text-[14px] text-gray-500 dark:text-gray-400 font-medium">@{user.unique_id}</p>
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
                  <div 
                    key={user.unique_id} 
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); handlePointerDown(e, user); }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); handlePointerUpOrLeave(); }}
                    onPointerCancel={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); handlePointerUpOrLeave(); }}
                    onClick={(e) => handleChatClick(e, user)}
                    className={`group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all active:scale-[0.98] active:opacity-70 border-b border-gray-50 dark:border-gray-700 last:border-0 ${hasStar ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''} ${longPressedChat?.unique_id === user.unique_id ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                  >
                    
                    <div className="w-11 h-11 shrink-0 relative pointer-events-none">
                      <div className="w-10 h-10 bg-gradient-to-tr from-chatverse to-purple-500 p-[2px] rounded-full shadow-sm">
                        <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-chatverse dark:text-indigo-400 font-bold text-lg uppercase">{user.username.charAt(0)}</div>
                      </div>
                      {hasStar && (
                        <div className="absolute -bottom-1 right-0 bg-yellow-400 p-[3px] rounded-full border border-white dark:border-gray-800">
                          <Star className="w-[10px] h-[10px] text-white fill-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-1 pointer-events-none">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                           <h3 className={`text-[16px] truncate flex items-center ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-bold text-gray-900 dark:text-gray-100'}`}>
                             {user.username}
                             {user.is_verified && <BadgeCheck className="w-[15px] h-[15px] text-[#1d9bf0] ml-1 shrink-0" />}
                           </h3>
                           {hasStar && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-[4px] leading-none tracking-wide">PINNED</span>}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-[11.5px] whitespace-nowrap ${isUnread ? 'font-bold text-chatverse dark:text-indigo-400' : 'font-medium text-gray-400 dark:text-gray-500'}`}>
                             {formatTime(user.last_message_time)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-[14px] truncate max-w-[210px] ${isUnread ? 'font-bold text-gray-800 dark:text-gray-200' : 'font-medium text-gray-500 dark:text-gray-400'}`}>
                          {typingUsers[user.unique_id] ? (
                            <span className="font-bold text-[#4ADE80] italic">typing...</span>
                          ) : (
                            previewText
                          )}
                        </p>
                        
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

      {longPressedChat && (
        <div className="absolute inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setLongPressedChat(null)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[24px] p-5 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-6 mt-2">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-3">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="font-black text-[18px] text-gray-900 dark:text-white">Delete Chat?</h3>
              <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Are you sure you want to permanently delete your chat with <span className="font-bold text-gray-700 dark:text-gray-300">"{longPressedChat.username}"</span>?
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDeleteChat} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm">
                Yes, Delete Chat
              </button>
              <button onClick={() => setLongPressedChat(null)} className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3.5 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showFriendsModal && (
        <div className="absolute inset-0 z-[100] bg-[#f4f6f8] dark:bg-gray-900 flex flex-col animate-slide-up">
          <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 py-4 z-20 shrink-0 border-b border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
            <button onClick={() => setShowFriendsModal(false)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              <ArrowLeft className="w-[22px] h-[22px]" />
            </button>
            <div>
               <h1 className="text-[19px] font-black text-gray-900 dark:text-white leading-none tracking-tight">Select friend</h1>
               <p className="text-[12px] text-gray-500 font-medium mt-1">{friendsList.length} contacts</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
             <div onClick={() => { setShowFriendsModal(false); setTimeout(() => searchInputRef.current?.focus(), 100); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 transition-colors">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-chatverse dark:text-indigo-400">
                   <UserPlus className="w-6 h-6" />
                </div>
                <span className="font-bold text-[15px] text-gray-900 dark:text-white">Find new friends</span>
             </div>

             <div className="px-6 py-3 text-[12px] font-black text-gray-400 uppercase tracking-wider">Your Friends</div>
             
             {friendsLoading ? (
               <div className="flex justify-center py-8"><Loader className="w-6 h-6 text-chatverse animate-spin" /></div>
             ) : friendsList.length === 0 ? (
               <div className="text-center py-10 px-6 text-gray-400 font-medium text-[14.5px] leading-relaxed">
                 You don't have any friends yet.<br/>Click "Find new friends" to start connecting!
               </div>
             ) : (
               <div className="bg-white dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700">
                 {friendsList.map(friend => (
                   <div key={friend.unique_id} onClick={() => { setShowFriendsModal(false); navigate(`/chat/${friend.unique_id}`, { state: { name: friend.username, id: friend.unique_id } }) }} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors">
                      <div className="w-10 h-10 bg-gradient-to-tr from-chatverse to-purple-500 rounded-full flex items-center justify-center text-white font-bold uppercase shadow-sm shrink-0">
                         {friend.username.charAt(0)}
                      </div>
                      <div className="flex-1">
                         <h3 className="font-bold text-[16px] text-gray-900 dark:text-white flex items-center">
                           {friend.username}
                           {friend.is_verified && <BadgeCheck className="w-[15px] h-[15px] text-[#1d9bf0] ml-1 shrink-0" />}
                         </h3>
                         <p className="text-[14px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{friend.bio}</p>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}