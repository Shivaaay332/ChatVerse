import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, MessageSquare, Grid, Check, Loader, UserCheck, MoreVertical, Star, BellOff, Shield, Ban, UserMinus, ChevronRight, BadgeCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../api';
import { PostItem } from './HomeFeed'; 

export default function UserProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = location.state?.user || {};
  
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || {};
  const isMe = user.unique_id === currentUser.unique_id; 

  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bioText, setBioText] = useState(user.bio || ""); 
  
  const [requestStatus, setRequestStatus] = useState('loading'); 
  const [requestId, setRequestId] = useState(null); 

  const [showMenu, setShowMenu] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null); 
  const [isMuted, setIsMuted] = useState(localStorage.getItem(`cv_mute_${user.unique_id}`) === 'true');
  const [isFavorite, setIsFavorite] = useState(localStorage.getItem(`cv_fav_${user.unique_id}`) === 'true');
  const [customPrivacy, setCustomPrivacy] = useState(localStorage.getItem(`cv_privacy_${user.unique_id}`) === 'true');

  useEffect(() => {
    if (!user.unique_id) { navigate('/chats'); return; }
    if (user.unique_id === currentUser.unique_id) { navigate('/profile', { replace: true }); return; }

    let isMounted = true; // FIX: Memory leak prevent karne ke liye flag

    const fetchProfileData = async () => {
      try {
        // FIX: Teeno APIs ko ek sath (Parallel) call kar rahe hain performance badhane ke liye
        const [postsRes, statusRes, userRes] = await Promise.all([
          api.get(`/posts/user/${user.unique_id}`),
          api.get(`/friends/status/${user.unique_id}`),
          api.get(`/users/search?query=${user.unique_id}`)
        ]);

        if (!isMounted) return; // Component band ho gaya toh state update mat karo

        setUserPosts(postsRes.data);
        
        if (statusRes.data.status === 'none') {
          setRequestStatus('none');
        } else if (statusRes.data.status === 'accepted') {
          setRequestStatus('friends');
        } else if (statusRes.data.status === 'pending') {
          setRequestId(statusRes.data.id);
          if (statusRes.data.sender_id === currentUser.unique_id) {
            setRequestStatus('sent');
          } else {
            setRequestStatus('received');
          }
        }

        const exactUser = userRes.data.find(u => u.unique_id === user.unique_id);
        if (exactUser && exactUser.bio) {
          setBioText(exactUser.bio);
        }
      } catch (error) {
        console.error("Failed to load user profile data", error);
        if (isMounted) setRequestStatus('none');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchProfileData();
    
    return () => { isMounted = false; }; // Cleanup function for memory safety
  }, [user.unique_id, navigate, currentUser.unique_id]);

  const handleSendRequest = async () => {
    const prevStatus = requestStatus; // State backup
    try {
      setRequestStatus('loading_action');
      await api.post('/friends/request', { receiver_id: user.unique_id });
      setRequestStatus('sent');
    } catch (err) { 
      setRequestStatus(prevStatus); // FIX: Error aane par purani state wapas laao
      alert("Error sending request."); 
    }
  };

  const handleAcceptRequest = async () => {
    const prevStatus = requestStatus;
    try {
      setRequestStatus('loading_action');
      await api.put(`/friends/accept/${requestId}`);
      setRequestStatus('friends');
      const postsRes = await api.get(`/posts/user/${user.unique_id}`);
      setUserPosts(postsRes.data);
    } catch (err) { 
      setRequestStatus(prevStatus); 
      alert("Error accepting request."); 
    }
  };

  const handleUnfriend = async () => {
    if (window.confirm(`Are you sure you want to unfriend ${user.username}?`)) {
      const prevStatus = requestStatus;
      try {
        setRequestStatus('loading_action');
        if (requestId) await api.delete(`/friends/reject/${requestId}`);
        else {
          const statusRes = await api.get(`/friends/status/${user.unique_id}`);
          if (statusRes.data.id) await api.delete(`/friends/reject/${statusRes.data.id}`);
        }
        setRequestStatus('none');
        setRequestId(null);
        setUserPosts([]); 
      } catch (err) { 
        setRequestStatus(prevStatus); 
        alert("Error removing friend."); 
      }
    }
  };

  const handleBlock = async () => {
    if (window.confirm(`Are you sure you want to block ${user.username}? They won't be able to message or find you.`)) {
      try {
        await api.post('/users/block', { blocked_id: user.unique_id }).catch(() => {});
        alert(`@${user.unique_id} has been blocked.`);
        navigate('/home');
      } catch (err) { alert("Failed to block user."); }
    }
  };

  const handleMessage = async () => {
    // FIX: Message bhejte time block list pehle check karo
    try {
      const blockedRes = await api.get('/users/blocked');
      const isBlocked = blockedRes.data.some(u => u.blocked_id === user.unique_id);
      if (isBlocked) {
        alert("You cannot message a blocked user. Unblock them in settings first.");
        return;
      }
      navigate(`/chat/${user.unique_id}`, { state: { name: user.username, id: user.unique_id } });
    } catch(err) {
      navigate(`/chat/${user.unique_id}`, { state: { name: user.username, id: user.unique_id } }); // Fallback
    }
  };

  const toggleMute = () => {
    const newValue = !isMuted;
    setIsMuted(newValue);
    localStorage.setItem(`cv_mute_${user.unique_id}`, newValue);
    window.dispatchEvent(new Event('chatverse_settings_updated')); // FIX: Global Event for ChatList
    setShowMenu(false);
  };

  const toggleFavorite = () => {
    const newValue = !isFavorite;
    setIsFavorite(newValue);
    localStorage.setItem(`cv_fav_${user.unique_id}`, newValue);
    window.dispatchEvent(new Event('chatverse_settings_updated')); // FIX: Global Event for ChatList
    setShowMenu(false);
  };

  const toggleCustomPrivacy = () => {
    const newValue = !customPrivacy;
    setCustomPrivacy(newValue);
    localStorage.setItem(`cv_privacy_${user.unique_id}`, newValue);
    window.dispatchEvent(new Event('chatverse_settings_updated')); // FIX: Global Event
    setShowMenu(false);
  };

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-gray-900 flex flex-col relative transition-colors">
      
      {/* UNIVERSAL HEADER */}
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 z-20 shrink-0 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <ArrowLeft className="w-[22px] h-[22px]" />
          </button>
          <h1 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight leading-none">Profile</h1>
        </div>
        
        {!isMe && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              <MoreVertical className="w-[22px] h-[22px]" />
            </button>

            {showMenu && <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}></div>}
            
            {showMenu && (
              <div className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-40 animate-slide-up">
                <button onClick={toggleFavorite} className="w-full text-left px-4 py-3.5 text-[14px] text-gray-800 dark:text-gray-200 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-colors">
                  <Star className={`w-[18px] h-[18px] ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} /> 
                  {isFavorite ? 'Remove from Favorites' : 'Mark as Favorite'}
                </button>
                <button onClick={toggleMute} className="w-full text-left px-4 py-3.5 text-[14px] text-gray-800 dark:text-gray-200 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-colors border-t border-gray-50 dark:border-gray-700/50">
                  <BellOff className={`w-[18px] h-[18px] ${isMuted ? 'text-red-400' : ''}`} /> 
                  {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                </button>
                <button onClick={toggleCustomPrivacy} className="w-full text-left px-4 py-3.5 text-[14px] text-gray-800 dark:text-gray-200 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-colors border-t border-gray-50 dark:border-gray-700/50">
                  <Shield className={`w-[18px] h-[18px] ${customPrivacy ? 'text-green-500' : ''}`} /> 
                  {customPrivacy ? 'Disable Custom Privacy' : 'Enable Custom Privacy'}
                </button>
                <button onClick={handleBlock} className="w-full text-left px-4 py-3.5 text-[14px] text-red-500 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors border-t border-gray-100 dark:border-gray-700/80">
                  <Ban className="w-[18px] h-[18px]" /> Block User
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 px-6 py-8 shadow-sm border-b border-gray-100 dark:border-gray-700 flex flex-col items-center relative rounded-b-[24px] z-10">
        <div className="w-24 h-24 bg-gradient-to-tr from-chatverse to-purple-400 rounded-full p-1 shadow-md mb-4 relative">
          <div className="w-full h-full bg-white dark:bg-gray-900 rounded-full flex items-center justify-center uppercase">
            <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-tr from-chatverse to-purple-500">{user.username?.charAt(0) || '?'}</span>
          </div>
          {isFavorite && !isMe && (
            <div className="absolute -bottom-1 -right-1 bg-yellow-400 p-1.5 rounded-full border-2 border-white dark:border-gray-800 shadow-sm">
              <Star className="w-3.5 h-3.5 text-white fill-white" />
            </div>
          )}
        </div>
        
        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          {user.username}
        </h2>
        <p className="text-[13px] text-chatverse dark:text-indigo-400 font-bold mt-0.5">@{user.unique_id}</p>
        
        <p className="text-[14px] text-gray-600 dark:text-gray-300 mt-4 text-center px-4 font-medium max-w-[280px] leading-relaxed">
          {bioText || "Available on ChatVerse ✨"}
        </p>
        
        {isMe ? (
          <div className="flex items-center justify-center mt-6 w-full px-2 py-3 bg-gray-100 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-gray-500 dark:text-gray-400 font-bold text-[14px]">👁️ This is how your profile looks to others</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-6 w-full px-2">
            <button onClick={handleMessage} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-bold py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2 transition-colors shadow-sm">
              <MessageSquare className="w-5 h-5" /> Message
            </button>
            
            {requestStatus === 'loading' || requestStatus === 'loading_action' ? (
               <button disabled className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-500 font-semibold py-2.5 rounded-xl flex items-center justify-center">
                 <Loader className="w-5 h-5 animate-spin" />
               </button>
            ) : requestStatus === 'friends' ? (
               <button onClick={handleUnfriend} className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-chatverse dark:text-indigo-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800/50 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors shadow-sm group">
                 <UserCheck className="w-5 h-5 group-hover:hidden" />
                 <UserMinus className="w-5 h-5 hidden group-hover:block" />
                 <span className="group-hover:hidden">Friends</span>
                 <span className="hidden group-hover:block">Unfriend</span>
               </button>
            ) : requestStatus === 'sent' ? (
               <button disabled className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-600">
                 <Check className="w-5 h-5" /> Request Sent
               </button>
            ) : requestStatus === 'received' ? (
               <button onClick={handleAcceptRequest} className="flex-1 bg-green-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-md hover:shadow-lg">
                 <Check className="w-5 h-5" /> Accept
               </button>
            ) : (
               <button onClick={handleSendRequest} className="flex-1 bg-chatverse text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg">
                 <UserPlus className="w-5 h-5" /> Add Friend
               </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 bg-gray-50 dark:bg-gray-900 mt-2">
        <div className="flex items-center justify-center py-3 border-b border-gray-200 dark:border-gray-800 mx-4 mb-2">
          <Grid className="w-[22px] h-[22px] text-chatverse dark:text-indigo-400" />
        </div>
        
        {loading ? (
          <div className="flex justify-center mt-12"><Loader className="w-7 h-7 text-chatverse animate-spin" /></div>
        ) : !isMe && requestStatus !== 'friends' ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 px-6 text-center">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <Shield className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="font-bold text-gray-900 dark:text-gray-300 text-[16px]">This Profile is Private</p>
            <p className="text-[13px] mt-1 font-medium text-gray-500">Add them as a friend to see their posts and updates.</p>
          </div>
        ) : userPosts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <Grid className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="font-bold text-gray-900 dark:text-gray-300 text-[16px]">No Posts Yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[2px] p-1">
            {userPosts.map((post) => (
              <div 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className="bg-white dark:bg-gray-800 aspect-square p-2 border border-gray-100 dark:border-gray-700 flex flex-col justify-center text-center hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors cursor-pointer group shadow-sm"
              >
                <p className="text-[11px] sm:text-[13px] text-gray-800 dark:text-gray-200 line-clamp-4 leading-relaxed font-medium group-hover:text-chatverse dark:group-hover:text-indigo-300 transition-colors break-words">
                  {post.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPost && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedPost(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-[24px]" onClick={e => e.stopPropagation()}>
             <PostItem post={selectedPost} isModal={true} onClose={() => setSelectedPost(null)} />
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}