import { useState, useEffect } from 'react';
import { ArrowLeft, Edit3, Grid, Loader, Check, X, ChevronRight, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav'; 
import api from '../api'; 
import { PostItem } from './HomeFeed'; 

export default function Profile() {
  const navigate = useNavigate();
  const [myPosts, setMyPosts] = useState([]);
  const [friendCount, setFriendCount] = useState(0); 
  const [loading, setLoading] = useState(true);
  const [isEditingBio, setIsEditingBio] = useState(false);
  
  const [userProfile, setUserProfile] = useState(JSON.parse(localStorage.getItem('chatverse_user')) || {});
  const [bioText, setBioText] = useState(userProfile.bio || "Available on ChatVerse ✨");

  const [selectedPost, setSelectedPost] = useState(null);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const fetchData = async () => {
    try {
      const postsRes = await api.get(`/posts/user/${userProfile.unique_id}`);
      setMyPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      
      const statsRes = await api.get(`/users/me/stats`);
      setFriendCount(Number(statsRes.data.friendsCount) || 0);
    } catch (error) { console.error("Failed to load"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (userProfile.unique_id) fetchData(); }, [userProfile.unique_id]);

  const handleSaveBio = async () => {
    try {
      await api.put('/users/me/bio', { bio: bioText });
      const updatedUser = { ...userProfile, bio: bioText };
      localStorage.setItem('chatverse_user', JSON.stringify(updatedUser));
      setUserProfile(updatedUser);
      setIsEditingBio(false);
    } catch (err) { alert("Failed to save bio!"); }
  };

  const updateLocalPost = (id, newContent) => {
    setMyPosts(myPosts.map(p => p.id === id ? { ...p, content: newContent } : p));
  };
  const removeLocalPost = (id) => {
    setMyPosts(myPosts.filter(p => p.id !== id));
  };

  const handleOpenFriends = async () => {
    setShowFriendsModal(true);
    setLoadingFriends(true);
    try {
      const res = await api.get('/friends');
      setFriendsList(res.data);
    } catch(err) { console.error(err); }
    setLoadingFriends(false);
  };

  return (
    <div className="h-full w-full bg-[#f4f6f8] dark:bg-gray-900 flex flex-col relative transition-colors overflow-hidden">
      
      {/* UNIVERSAL HEADER */}
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 z-20 shrink-0 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <ArrowLeft className="w-[22px] h-[22px]" />
          </button>
          <h1 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight leading-none">My Profile</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        
        {/* COMPACT PROFILE BANNER START */}
        <div className="bg-white dark:bg-gray-800 pt-5 pb-5 px-5 shadow-sm flex flex-col items-center relative z-10 border-b border-gray-100 dark:border-gray-700 rounded-b-[24px]">
          <div className="relative">
            {/* Avatar size reduced from w-28 h-28 to w-20 h-20 */}
            <div className="w-20 h-20 bg-gradient-to-tr from-chatverse via-purple-500 to-pink-500 rounded-full p-[3px] shadow-sm">
              <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center uppercase border-[2px] border-white dark:border-gray-800">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-chatverse to-purple-500">
                  {userProfile.username?.charAt(0) || '?'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-3">
            {/* Name size reduced from text-2xl to text-xl */}
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{userProfile.username}</h2>
            <p className="text-[13px] text-chatverse dark:text-indigo-400 font-bold mt-0.5">@{userProfile.unique_id}</p>
          </div>

          <div className="mt-3 w-full flex flex-col items-center">
            {isEditingBio ? (
              <div className="w-full max-w-[260px] flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-1 rounded-xl border border-gray-200 dark:border-gray-600 shadow-inner">
                <input 
                  type="text" value={bioText} onChange={(e) => setBioText(e.target.value)} 
                  className="flex-1 bg-transparent dark:text-white text-[13px] focus:outline-none text-center font-medium pl-2" autoFocus maxLength={50} 
                />
                <button onClick={handleSaveBio} className="p-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"><Check className="w-3.5 h-3.5"/></button>
                <button onClick={() => {setIsEditingBio(false); setBioText(userProfile.bio || "");}} className="p-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"><X className="w-3.5 h-3.5"/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingBio(true)}>
                <p className="text-[13px] text-gray-600 dark:text-gray-300 font-medium whitespace-pre-wrap text-center max-w-[260px] leading-snug">
                  {userProfile.bio || "Add a bio to your profile ✨"}
                </p>
                <Edit3 className="w-[12px] h-[12px] text-gray-300 dark:text-gray-500 group-hover:text-chatverse transition-colors" />
              </div>
            )}
          </div>
          
          <div className="flex w-full max-w-[260px] justify-between mt-5 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-[16px] border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex flex-col items-center w-1/2">
              <span className="font-black text-xl text-gray-900 dark:text-white">{myPosts.length}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-400 uppercase tracking-wider font-bold mt-0.5">Posts</span>
            </div>
            <div className="w-[1px] h-8 bg-gray-200 dark:bg-gray-600 self-center rounded-full"></div>
            <div onClick={handleOpenFriends} className="flex flex-col items-center w-1/2 cursor-pointer hover:opacity-70 transition-opacity">
              <span className="font-black text-xl text-gray-900 dark:text-white">{friendCount}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-400 uppercase tracking-wider font-bold mt-0.5">Friends</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-center mb-2">
            <h3 className="text-[12px] font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase">Your Posts Activity</h3>
          </div>
          
          {loading ? ( 
            <div className="flex justify-center mt-10"><Loader className="w-6 h-6 text-chatverse animate-spin" /></div> 
          ) : myPosts.length === 0 ? ( 
            <div className="py-12 mx-4 flex flex-col items-center justify-center text-gray-400 bg-white dark:bg-gray-800 rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm mt-4">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                <Grid className="w-7 h-7 text-gray-300 dark:text-gray-500" />
              </div>
              <p className="font-bold text-gray-900 dark:text-white">No Posts Yet</p>
              <p className="text-[13px] font-medium text-gray-400 mt-1">Share your thoughts on the Home feed.</p>
            </div> 
          ) : ( 
            <div className="grid grid-cols-3 gap-[2px] p-1">
              {myPosts.map((post) => (
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
      </div>

      {selectedPost && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedPost(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-[24px]" onClick={e => e.stopPropagation()}>
             <PostItem 
               post={selectedPost} 
               isModal={true}
               onClose={() => setSelectedPost(null)}
               onPostUpdate={(id, content) => { updateLocalPost(id, content); setSelectedPost({...selectedPost, content}); }} 
               onPostDelete={(id) => { removeLocalPost(id); setSelectedPost(null); }} 
             />
          </div>
        </div>
      )}

      {showFriendsModal && (
        <div className="absolute inset-0 z-[100] bg-[#f4f6f8] dark:bg-gray-900 flex flex-col animate-slide-up">
          <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 z-20 shrink-0 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowFriendsModal(false)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <ArrowLeft className="w-[22px] h-[22px]" />
              </button>
              <div>
                 <h1 className="text-[19px] font-black text-gray-900 dark:text-white leading-none tracking-tight">Your Friends</h1>
                 <p className="text-[12px] text-gray-500 font-medium mt-1">{friendsList.length} friends</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
             {loadingFriends ? (
               <div className="flex justify-center py-10"><Loader className="w-7 h-7 text-chatverse animate-spin" /></div>
             ) : friendsList.length === 0 ? (
               <div className="text-center py-16 px-6 text-gray-400 font-medium text-[15px] leading-relaxed">
                 You don't have any friends yet.<br/>Start connecting with people!
               </div>
             ) : (
               <div className="bg-white dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700">
                 {friendsList.map(friend => (
                   <div 
                     key={friend.unique_id} 
                     onClick={() => { setShowFriendsModal(false); navigate(`/user/${friend.unique_id}`, { state: { user: friend } }) }} 
                     className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors"
                   >
                      {/* ✅ FIX: Invalid w-13 hatakar w-12 h-12, min-w-[48px] aur aspect-square add kiya */}
                      <div className="w-12 h-12 min-w-[48px] aspect-square bg-gradient-to-tr from-chatverse to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg uppercase shadow-sm shrink-0">
                         {friend.username.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                         <h3 className="font-bold text-[16px] text-gray-900 dark:text-white flex items-center">
                           {friend.username}
                           {friend.is_verified && <BadgeCheck className="w-[15px] h-[15px] text-[#1d9bf0] ml-1 shrink-0" />}
                         </h3>
                         <p className="text-[14px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{friend.bio}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
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