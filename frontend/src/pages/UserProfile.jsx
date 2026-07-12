import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, MessageSquare, Grid, Check, Loader, UserCheck } from 'lucide-react';
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
  
  // States to handle real friend status
  const [requestStatus, setRequestStatus] = useState('loading'); // none, sent, received, friends
  const [requestId, setRequestId] = useState(null); 

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
          // Agar humne bheji hai toh 'sent', usne bheji hai toh 'received'
          if (statusRes.data.sender_id === currentUser.unique_id) {
            setRequestStatus('sent');
          } else {
            setRequestStatus('received');
          }
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

  const handleMessage = () => {
    navigate(`/chat/${user.unique_id}`, { state: { name: user.username, id: user.unique_id } });
  };

  return (
    <div className="h-full w-full bg-gray-50 flex flex-col relative">
      <div className="bg-white px-4 py-3 shadow-sm flex items-center gap-4 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-black transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Profile</h1>
      </div>

      <div className="bg-white px-6 py-6 shadow-sm border-b border-gray-100 flex flex-col items-center">
        <div className="w-24 h-24 bg-gradient-to-tr from-chatverse to-purple-400 rounded-full p-1 shadow-md mb-4">
          <div className="w-full h-full bg-white rounded-full flex items-center justify-center uppercase">
            <span className="text-4xl font-bold text-chatverse">{user.username?.charAt(0) || '?'}</span>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900">{user.username}</h2>
        <p className="text-sm text-gray-500 font-medium mt-1">@{user.unique_id}</p>
        <p className="text-sm text-gray-700 mt-3 text-center px-4">{user.bio || "ChatVerse User ✨"}</p>
        
        {/* ACTION BUTTONS (Dynamic based on DB status) */}
        <div className="flex items-center gap-3 mt-6 w-full px-4">
          <button 
            onClick={handleMessage}
            className="flex-1 bg-gray-100 text-gray-800 font-semibold py-2.5 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors"
          >
            <MessageSquare className="w-5 h-5" /> Message
          </button>
          
          {requestStatus === 'loading' || requestStatus === 'loading_action' ? (
             <button disabled className="flex-1 bg-gray-200 text-gray-500 font-semibold py-2.5 rounded-xl flex items-center justify-center">
               <Loader className="w-5 h-5 animate-spin" />
             </button>
          ) : requestStatus === 'friends' ? (
             <button disabled className="flex-1 bg-indigo-50 text-chatverse font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 border border-indigo-100">
               <UserCheck className="w-5 h-5" /> Friends
             </button>
          ) : requestStatus === 'sent' ? (
             <button disabled className="flex-1 bg-gray-100 text-gray-500 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
               <Check className="w-5 h-5" /> Request Sent
             </button>
          ) : requestStatus === 'received' ? (
             <button onClick={handleAcceptRequest} className="flex-1 bg-green-500 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-sm">
               <Check className="w-5 h-5" /> Accept
             </button>
          ) : (
             <button onClick={handleSendRequest} className="flex-1 bg-chatverse text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
               <UserPlus className="w-5 h-5" /> Add Friend
             </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 bg-white mt-1">
        <div className="flex items-center justify-center py-3 border-b border-gray-100">
          <Grid className="w-6 h-6 text-chatverse" />
        </div>
        
        {loading ? (
          <div className="flex justify-center mt-10"><Loader className="w-6 h-6 text-chatverse animate-spin" /></div>
        ) : userPosts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <Grid className="w-10 h-10 text-gray-300 mb-3" />
            <p className="font-semibold text-gray-900">No Posts</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 p-1">
            {userPosts.map((post) => (
              <div key={post.id} className="bg-gray-50 aspect-square p-4 border border-gray-100 flex flex-col justify-center text-center rounded-md hover:bg-indigo-50 transition-colors cursor-pointer group">
                <p className="text-xs text-gray-800 line-clamp-4 leading-relaxed font-medium group-hover:text-chatverse transition-colors">{post.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}