import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X, Bell, Loader, Heart, MessageCircle, UserPlus, AtSign, FileText, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../api';

const timeAgo = (dateString) => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString.endsWith('Z') ? dateString : `${dateString}Z`);
  const now = new Date();
  const seconds = Math.round((now - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // LONG PRESS STATES
  const [selectedNotifs, setSelectedNotifs] = useState([]);
  const pressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const initNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (!isMountedRef.current) return;
        
        setNotifications(res.data);
        setLoading(false);

        // FIX: Sirf tabhi mark-read API call karo agar actually me koi unread notification ho
        const hasUnread = res.data.some(n => !n.is_read);
        if (hasUnread) {
          await api.put('/notifications/read');
          // FIX: Global event dispatch taaki BottomNav ka Red Dot instantly gayab ho jaye (No Phantom Dots)
          window.dispatchEvent(new Event('chatverse_notifications_read'));
        }
      } catch (error) { 
        console.error("Error fetching alerts"); 
        if (isMountedRef.current) setLoading(false);
      }
    };

    initNotifications();

    return () => { isMountedRef.current = false; };
  }, []);

  // --- Long Press Handlers ---
  const toggleSelection = (id) => {
    setSelectedNotifs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handlePointerDown = (e, notif) => {
    if (notif.type === 'friend_request') return; // Cannot bulk delete friend requests
    longPressTriggered.current = false;
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (selectedNotifs.length === 0) {
        toggleSelection(notif.notif_id);
        if (window.navigator?.vibrate) window.navigator.vibrate(50);
      }
    }, 450);
  };

  const handlePointerMove = (e) => {
    const dx = Math.abs(e.clientX - touchStartPos.current.x);
    const dy = Math.abs(e.clientY - touchStartPos.current.y);
    if ((dx > 10 || dy > 10) && pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handlePointerUpOrLeave = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(selectedNotifs.map(id => api.delete(`/notifications/${id}`)));
      setNotifications(prev => prev.filter(n => !selectedNotifs.includes(n.notif_id)));
      setSelectedNotifs([]);
    } catch (error) { alert("Error deleting notifications"); }
  };

  // FIX: Action Loading State to prevent spam
  const [actionLoading, setActionLoading] = useState(null);

  // --- Friend Request Actions ---
  const handleAcceptRequest = async (id, e) => {
    if(e) e.stopPropagation(); 
    if (actionLoading) return;
    
    setActionLoading(id);
    try {
      await api.put(`/friends/accept/${id}`);
      if (isMountedRef.current) {
        setNotifications(prev => prev.filter(n => !(n.type === 'friend_request' && n.ref_id === id)));
      }
    } catch (error) { 
      alert("Error accepting request"); 
    } finally {
      if (isMountedRef.current) setActionLoading(null);
    }
  };

  const handleRejectRequest = async (id, e) => {
    if(e) e.stopPropagation();
    if (actionLoading) return;

    setActionLoading(id);
    try {
      await api.delete(`/friends/reject/${id}`);
      if (isMountedRef.current) {
        setNotifications(prev => prev.filter(n => !(n.type === 'friend_request' && n.ref_id === id)));
      }
    } catch (error) { 
      alert("Error rejecting request"); 
    } finally {
      if (isMountedRef.current) setActionLoading(null);
    }
  };

  const handleNotificationClick = async (notif) => {
    // FIX: Secure Navigation - Pehle block status verify karo
    try {
      const blockedRes = await api.get('/users/blocked');
      const isBlocked = blockedRes.data.some(u => u.blocked_id === notif.unique_id);
      if (isBlocked) {
        alert("You cannot view or interact with a blocked user.");
        return;
      }
      navigate(`/user/${notif.unique_id}`, { state: { user: { unique_id: notif.unique_id, username: notif.username } } });
    } catch (err) {
      navigate(`/user/${notif.unique_id}`, { state: { user: { unique_id: notif.unique_id, username: notif.username } } });
    }
  };

  const renderIcon = (type) => {
    switch(type) {
      case 'post_like': return <Heart className="w-[18px] h-[18px] text-white fill-white" />;
      case 'comment_like': return <Heart className="w-[18px] h-[18px] text-white fill-white" />;
      case 'post_comment': return <MessageCircle className="w-[18px] h-[18px] text-white fill-white" />;
      case 'mention': return <AtSign className="w-[18px] h-[18px] text-white stroke-[3px]" />;
      case 'new_post': return <FileText className="w-[18px] h-[18px] text-white" />;
      case 'friend_request': return <UserPlus className="w-[18px] h-[18px] text-white" />;
      default: return <Bell className="w-[18px] h-[18px] text-white" />;
    }
  };

  const renderIconColor = (type) => {
    switch(type) {
      case 'post_like': 
      case 'comment_like': return 'bg-pink-500';
      case 'post_comment': return 'bg-blue-500';
      case 'mention': return 'bg-purple-500';
      case 'new_post': return 'bg-green-500';
      case 'friend_request': return 'bg-chatverse';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors">
      
      {/* UNIVERSAL SELECTION OR STANDARD HEADER */}
      {selectedNotifs.length > 0 ? (
        <div className="bg-chatverse text-white px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 shadow-md flex justify-between items-center z-50 sticky top-0 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedNotifs([])} className="hover:bg-white/20 p-1.5 rounded-full"><X className="w-6 h-6" /></button>
            <span className="font-bold text-[18px]">{selectedNotifs.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleDeleteSelected} className="p-2 hover:bg-white/20 rounded-full"><Trash2 className="w-[22px] h-[22px]" /></button>
          </div>
        </div>
      ) : (
        <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 z-20 shrink-0 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              <ArrowLeft className="w-[22px] h-[22px]" />
            </button>
            <h1 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight leading-none">Notifications</h1>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-2">
        {loading ? (
          <div className="flex flex-col gap-5 px-5 pt-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-start gap-4 animate-pulse mb-2">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"></div>
                <div className="flex-1 flex flex-col gap-2.5 mt-1">
                  <div className="w-3/4 h-3 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="w-1/2 h-2 bg-gray-100 dark:bg-gray-600 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-gray-400">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="font-bold text-gray-900 dark:text-gray-300 text-lg">No Notifications</p>
            <p className="text-[14px] text-gray-500 mt-1 font-medium">When you get alerts, they'll show up here.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 mx-3 rounded-[24px] shadow-sm border border-gray-50 dark:border-gray-700 overflow-hidden mb-4">
            {notifications.map((notif, index) => {
              const isSelected = selectedNotifs.includes(notif.notif_id);
              return (
                <div 
                  key={index} 
                  // FIX: Pointer Events multi-touch capture
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); handlePointerDown(e, notif); }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); handlePointerUpOrLeave(); }}
                  onPointerCancel={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); handlePointerUpOrLeave(); }}
                  onClick={() => {
                    if (longPressTriggered.current) { longPressTriggered.current = false; return; }
                    if (selectedNotifs.length > 0 && notif.type !== 'friend_request') { toggleSelection(notif.notif_id); return; }
                    handleNotificationClick(notif);
                  }}
                  className={`group flex items-start justify-between px-4 py-4 border-b border-gray-50 dark:border-gray-700/80 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer select-none ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-400' : (!notif.is_read && notif.type !== 'friend_request' ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : '')}`}
                >
                  <div className="flex items-start gap-3.5 flex-1 pr-2 pointer-events-none">
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-12 h-12 bg-gradient-to-tr from-chatverse to-purple-500 rounded-full p-[2px] shadow-sm">
                         <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center font-bold text-chatverse dark:text-indigo-400 text-[16px] uppercase">
                           {notif.username.charAt(0)}
                         </div>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-gray-800 ${renderIconColor(notif.type)}`}>
                        {renderIcon(notif.type)}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center min-h-[48px]">
                      <p className="text-[14.5px] leading-snug text-gray-800 dark:text-gray-200">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {notif.username}
                        </span>
                        {notif.type === 'post_like' && " liked your post."}
                        {notif.type === 'comment_like' && " liked your comment."}
                        {notif.type === 'post_comment' && " commented on your post."}
                        {notif.type === 'mention' && " mentioned you in a comment."}
                        {notif.type === 'new_post' && " just published a new post."}
                        {notif.type === 'friend_request' && " sent you a friend request."}
                      </p>
                      
                      {notif.content && notif.type !== 'new_post' && (
                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                          "{notif.content}"
                        </p>
                      )}

                      <p className="text-[11.5px] text-gray-400 font-bold mt-1.5">{timeAgo(notif.created_at)}</p>
                    </div>
                  </div>

                  {notif.type === 'friend_request' && (
                    <div className="flex items-center gap-2 shrink-0 h-[38px]">
                      {actionLoading === notif.ref_id ? (
                        <div className="w-[84px] flex items-center justify-center">
                          <Loader className="w-6 h-6 text-chatverse animate-spin" />
                        </div>
                      ) : (
                        <>
                          <button onClick={(e) => handleAcceptRequest(notif.ref_id, e)} className="w-[38px] h-[38px] bg-chatverse text-white rounded-full flex items-center justify-center hover:bg-indigo-700 hover:scale-105 transition-all shadow-md">
                            <Check className="w-5 h-5" />
                          </button>
                          <button onClick={(e) => handleRejectRequest(notif.ref_id, e)} className="w-[38px] h-[38px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors">
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  
                </div>
              )
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}