import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, MessageSquare, Grid, Check, Loader, UserCheck, MoreVertical, Star, BellOff, Shield, Ban, UserMinus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../api';

export default function UserProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = location.state?.user || {};
  
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || {};

  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bioText, setBioText] = useState(user.bio || ""); 
  
  // States to handle real friend status
  const [requestStatus, setRequestStatus] = useState('loading'); // none, sent, received, friends
  const [requestId, setRequestId] = useState(null); 

  // New Feature States
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(localStorage.getItem(`cv_mute_${user.unique_id}`) === 'true');
  const [isFavorite, setIsFavorite] = useState(localStorage.getItem(`cv_fav_${user.unique_id}`) === 'true');
  const [customPrivacy, setCustomPrivacy] = useState(localStorage.getItem(`cv_privacy_${user.unique_id}`) === 'true');

  useEffect(() => {
    if (!user.unique_id) {
      navigate('/chats');
      return;
    }

    const fetchProfileData = async () => {
      try {
        // 1. Fetch Posts
        const postsRes = await api.get(`/posts/user/${user.unique_id}`);
        setUserPosts(postsRes.data);
        
        // 2. Fetch Real Friendship Status
        const statusRes = await api.get(`/friends/status/${user.unique_id}`);
        
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

        // 3. Fetch Accurate Bio (Fallback to search if accurate profile API is missing)
        const userRes = await api.get(`/users/search?query=${user.unique_id}`);
        const exactUser = userRes.data.find(u => u.unique_id === user.unique_id);
        if (exactUser && exactUser.bio) {
          setBioText(exactUser.bio);
        }

      } catch (error) {
        console.error("Failed to load user profile data", error);
        setRequestStatus('none');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileData();
  }, [user.unique_id, navigate, currentUser.unique_id]);

  const handleSendRequest = async () => {
    try {
      setRequestStatus('loading_action');
      await api.post('/friends/request', { receiver_id: user.unique_id });
      setRequestStatus('sent');
    } catch (err) {
      setRequestStatus('none');
      alert("Error sending request.");
    }
  };

  const handleAcceptRequest = async () => {
    try {
      setRequestStatus('loading_action');
      await api.put(`/friends/accept/${requestId}`);
      setRequestStatus('friends');
    } catch (err) {
      alert("Error accepting request.");
      setRequestStatus('received');
    }
  };

  // --- NEW: Unfriend Functionality ---
  const handleUnfriend = async () => {
    if (window.confirm(`Are you sure you want to unfriend ${user.username}?`)) {
      try {
        setRequestStatus('loading_action');
        if (requestId) {
          await api.delete(`/friends/reject/${requestId}`);
        } else {
          // Fallback logic if requestId is missing for some reason
          const statusRes = await api.get(`/friends/status/${user.unique_id}`);
          if (statusRes.data.id) {
             await api.delete(`/friends/reject/${statusRes.data.id}`);
          }
        }
        setRequestStatus('none');
        setRequestId(null);
      } catch (err) {
        alert("Error removing friend.");
        setRequestStatus('friends');
      }
    }
  };

  // --- NEW: Block Functionality ---
  const handleBlock = async () => {
    if (window.confirm(`Are you sure you want to block ${user.username}? They won't be able to message or find you.`)) {
      try {
        // Optimistically block user and push to home
        await api.post('/users/block', { blocked_id: user.unique_id }).catch(() => {});
        alert(`@${user.unique_id} has been blocked.`);
        navigate('/home');
      } catch (err) {
        alert("Failed to block user.");
      }
    }
  };

  const handleMessage = () => {
    navigate(`/chat/${user.unique_id}`, { state: { name: user.username, id: user.unique_id } });
  };

  // Toggles for extra settings
  const toggleMute = () => {
    setIsMuted(!isMuted);
    localStorage.setItem(`cv_mute_${user.unique_id}`, !isMuted);
    setShowMenu(false);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    localStorage.setItem(`cv_fav_${user.unique_id}`, !isFavorite);
    setShowMenu(false);
  };

  const toggleCustomPrivacy = () => {
    setCustomPrivacy(!customPrivacy);
    localStorage.setItem(`cv_privacy_${user.unique_id}`, !customPrivacy);
    setShowMenu(false);
  };

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-gray-900 flex flex-col relative transition-colors">
      
      {/* Header with 3-Dot Menu */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 shadow-sm flex items-center justify-between z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile</h1>
        </div>
        
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <MoreVertical className="w-[22px] h-[22px]" />
          </button>

          {/* Transparent Overlay for Menu Close */}
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
      </div>

      <div className="bg-white dark:bg-gray-800 px-6 py-8 shadow-sm border-b border-gray-100 dark:border-gray-700 flex flex-col items-center relative rounded-b-[24px] z-10">
        <div className="w-24 h-24 bg-gradient-to-tr from-chatverse to-purple-400 rounded-full p-1 shadow-md mb-4 relative">
          <div className="w-full h-full bg-white dark:bg-gray-900 rounded-full flex items-center justify-center uppercase">
            <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-tr from-chatverse to-purple-500">{user.username?.charAt(0) || '?'}</span>
          </div>
          {isFavorite && (
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
        
        {/* ACTION BUTTONS (Dynamic based on DB status) */}
        <div className="flex items-center gap-3 mt-6 w-full px-2">
          <button 
            onClick={handleMessage}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-bold py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
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
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 bg-gray-50 dark:bg-gray-900 mt-2">
        <div className="flex items-center justify-center py-4 border-b border-gray-200 dark:border-gray-800 mx-4">
          <Grid className="w-[22px] h-[22px] text-chatverse dark:text-indigo-400" />
        </div>
        
        {loading ? (
          <div className="flex justify-center mt-12"><Loader className="w-7 h-7 text-chatverse animate-spin" /></div>
        ) : userPosts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <Grid className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="font-bold text-gray-900 dark:text-gray-300 text-[16px]">No Posts Yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[2px] p-1">
            {userPosts.map((post) => (
              <div key={post.id} className="bg-white dark:bg-gray-800 aspect-square p-4 border border-gray-100 dark:border-gray-700 flex flex-col justify-center text-center hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors cursor-pointer group shadow-sm">
                <p className="text-[13px] text-gray-800 dark:text-gray-200 line-clamp-4 leading-relaxed font-medium group-hover:text-chatverse dark:group-hover:text-indigo-300 transition-colors break-words">
                  {post.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}