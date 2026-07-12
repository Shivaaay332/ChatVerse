import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchNotifications();
    markAsRead();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (error) { console.error("Error fetching alerts"); } 
    finally { setLoading(false); }
  };

  const markAsRead = async () => {
    try { await api.put('/notifications/read'); } 
    catch (e) { /* ignore silently */ }
  };

  // --- Actions ---
  const handleAcceptRequest = async (id, e) => {
    if(e) e.stopPropagation(); // Clickable row par bubble na hone dein
    try {
      await api.put(`/friends/accept/${id}`);
      setNotifications(prev => prev.filter(n => !(n.type === 'friend_request' && n.ref_id === id)));
    } catch (error) { alert("Error accepting request"); }
  };

  const handleRejectRequest = async (id, e) => {
    if(e) e.stopPropagation();
    try {
      await api.delete(`/friends/reject/${id}`);
      setNotifications(prev => prev.filter(n => !(n.type === 'friend_request' && n.ref_id === id)));
    } catch (error) { alert("Error deleting request"); }
  };

  const handleDeleteNotification = async (notifId, e) => {
    if(e) e.stopPropagation();
    try {
      await api.delete(`/notifications/${notifId}`);
      setNotifications(prev => prev.filter(n => n.notif_id !== notifId));
    } catch (error) { alert("Error deleting notification"); }
  };

  const handleNotificationClick = (notif) => {
    // Navigation to the user's profile contextually
    navigate(`/user/${notif.unique_id}`, { state: { user: { unique_id: notif.unique_id, username: notif.username } } });
  };

  // --- Helper Icons ---
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
      
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 py-4 flex items-center gap-4 z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft className="w-[22px] h-[22px]" />
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Notifications</h1>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-2">
        {loading ? (
          <div className="flex justify-center mt-12"><Loader className="w-7 h-7 text-chatverse animate-spin" /></div>
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
            {notifications.map((notif, index) => (
              
              <div 
                key={index} 
                onClick={() => handleNotificationClick(notif)}
                className={`group flex items-start justify-between px-4 py-4 border-b border-gray-50 dark:border-gray-700/80 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${!notif.is_read && notif.type !== 'friend_request' ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
              >
                {/* Left Side: Avatar & Content */}
                <div className="flex items-start gap-3.5 flex-1 pr-2">
                  {/* Avatar with Floating Icon */}
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

                  {/* Content Body */}
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
                    
                    {/* Snippet Context Preview */}
                    {notif.content && notif.type !== 'new_post' && (
                      <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                        "{notif.content}"
                      </p>
                    )}

                    <p className="text-[11.5px] text-gray-400 font-bold mt-1.5">{timeAgo(notif.created_at)}</p>
                  </div>
                </div>

                {/* Right Side: Action Buttons */}
                {notif.type === 'friend_request' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => handleAcceptRequest(notif.ref_id, e)} className="w-[38px] h-[38px] bg-chatverse text-white rounded-full flex items-center justify-center hover:bg-indigo-700 hover:scale-105 transition-all shadow-md">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={(e) => handleRejectRequest(notif.ref_id, e)} className="w-[38px] h-[38px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={(e) => handleDeleteNotification(notif.notif_id, e)} 
                    className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all sm:opacity-0 sm:group-hover:opacity-100 shrink-0 self-center"
                    title="Delete Notification"
                  >
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                )}
                
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}