import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, MoreVertical, Trash2, Edit3, Copy, Image as ImageIcon } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import api from '../api';

const timeAgo = (dateString) => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
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

const PostItem = ({ post, onPostUpdate, onPostDelete }) => {
  const [liked, setLiked] = useState(post.has_liked === true || post.has_liked === 'true');
  const [likeCount, setLikeCount] = useState(Number(post.like_count) || 0); 
  const [commentCount, setCommentCount] = useState(Number(post.comment_count) || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || { unique_id: '' };
  const isMyPost = post.unique_id === currentUser.unique_id;

  const handleLikeToggle = async () => {
    const prevLiked = liked;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? likeCount - 1 : likeCount + 1);
    try { await api.post(`/posts/${post.id}/like`); } 
    catch (error) { setLiked(prevLiked); setLikeCount(prevLiked ? likeCount : likeCount - 1); }
  };

  const toggleComments = async () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await api.get(`/posts/${post.id}/comments`);
        setComments(Array.isArray(res.data) ? res.data : []);
      } catch(err) { console.error(err); }
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const text = newComment;
      setNewComment('');
      setCommentCount(commentCount + 1);
      setComments([...comments, { id: Date.now(), comment: text, username: currentUser.username }]);
      await api.post(`/posts/${post.id}/comments`, { comment: text });
    } catch (error) { alert("Failed to add comment"); }
  };

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    try {
      await api.put(`/posts/${post.id}`, { content: editContent });
      onPostUpdate(post.id, editContent); // Optimistic UI update
      setIsEditing(false);
    } catch (err) { alert("Error saving edit"); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(post.content);
    setShowMenu(false);
    alert("Text copied to clipboard!");
  };

  const handleDeletePost = async () => {
    if(window.confirm("Permanently delete this post?")) {
      try {
        await api.delete(`/posts/${post.id}`);
        setShowMenu(false);
        onPostDelete(post.id); 
      } catch (err) { alert("Error deleting"); }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 mb-5 mx-4 p-5 rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none border border-gray-50 dark:border-gray-700 transition-all">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full p-[2px] shadow-sm">
            <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-900 dark:text-white font-bold text-[15px] uppercase">
              {post.username?.charAt(0) || 'U'}
            </div>
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-gray-900 dark:text-white text-[15px]">{post.username}</h3>
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        
        {/* PREMIUM 3-DOT MENU */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-10 w-44 bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-20 animate-slide-up">
              <button onClick={handleCopy} className="w-full text-left px-4 py-3.5 text-[14px] text-gray-700 dark:text-gray-200 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition-colors">
                <Copy className="w-[18px] h-[18px]"/> Copy Text
              </button>
              
              {isMyPost && (
                <>
                  <button onClick={() => {setIsEditing(true); setShowMenu(false);}} className="w-full text-left px-4 py-3.5 text-[14px] text-indigo-600 dark:text-indigo-400 flex items-center gap-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold transition-colors border-t border-gray-50 dark:border-gray-700">
                    <Edit3 className="w-[18px] h-[18px]"/> Edit Post
                  </button>
                  <button onClick={handleDeletePost} className="w-full text-left px-4 py-3.5 text-[14px] text-red-500 flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors border-t border-gray-50 dark:border-gray-700">
                    <Trash2 className="w-[18px] h-[18px]"/> Delete Post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* EDITING MODE VS NORMAL MODE */}
      {isEditing ? (
        <div className="py-2">
           <textarea
             value={editContent} onChange={(e) => setEditContent(e.target.value)}
             className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-chatverse transition-all resize-none text-[15px]"
             rows="3"
           />
           <div className="flex justify-end gap-2 mt-2">
             <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 text-[13px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
             <button onClick={handleEditSave} className="px-4 py-1.5 text-[13px] font-bold bg-chatverse text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Save Changes</button>
           </div>
        </div>
      ) : (
        <div className="py-1 px-1">
          <p className="text-gray-800 dark:text-gray-200 text-[15px] leading-[1.6] whitespace-pre-wrap font-medium">
            {post.content}
          </p>
        </div>
      )}
      
      {/* Interaction Bar */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
        <button onClick={handleLikeToggle} className={`flex items-center gap-2 transition-all ${liked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'}`}>
          <Heart className={`w-6 h-6 transition-transform ${liked ? 'fill-red-500 scale-[1.15]' : ''}`} /> 
          <span className="text-[14px] font-bold">{likeCount}</span>
        </button>
        <button onClick={toggleComments} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-chatverse transition-colors">
          <MessageCircle className="w-6 h-6" /> 
          <span className="text-[14px] font-bold">{commentCount}</span>
        </button>
      </div>

      {/* Comments Area */}
      {showComments && (
        <div className="mt-4 animate-slide-down bg-gray-50/50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
          {loadingComments ? (
            <div className="py-4 flex justify-center"><div className="w-5 h-5 border-2 border-chatverse border-t-transparent rounded-full animate-spin"></div></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 font-medium py-2">No comments yet. Be the first!</p>
          ) : (
            <div className="flex flex-col gap-3 mb-4 max-h-48 overflow-y-auto no-scrollbar">
              {comments.map(c => (
                <div key={c.id} className="flex flex-col bg-white dark:bg-gray-700 px-3.5 py-2.5 rounded-[16px] shadow-sm border border-gray-50 dark:border-gray-600 w-fit max-w-[90%]">
                  <span className="font-bold text-[12px] text-gray-900 dark:text-gray-100 mb-0.5">{c.username}</span>
                  <span className="text-[14px] text-gray-700 dark:text-gray-200 leading-snug">{c.comment}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 relative">
            <input 
              type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..." 
              className="flex-1 bg-white dark:bg-gray-700 dark:text-white rounded-full px-4 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 shadow-sm transition-all placeholder-gray-400"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
            />
            <button onClick={handleAddComment} disabled={!newComment.trim()} className={`p-2.5 rounded-full transition-all ${newComment.trim() ? 'bg-chatverse text-white shadow-md hover:scale-105 hover:bg-indigo-700' : 'bg-gray-200 dark:bg-gray-600 text-gray-400'}`}>
              <Send className="w-[18px] h-[18px] ml-0.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function HomeFeed() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || { username: 'Me' };

  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts');
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setPosts([]); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;
    try {
      await api.post('/posts', { content: newPost });
      setNewPost(''); 
      fetchPosts();   
    } catch (err) { alert("Error posting"); }
  };

  // State Updates from child components
  const updateLocalPost = (id, newContent) => {
    setPosts(posts.map(p => p.id === id ? { ...p, content: newContent } : p));
  };
  const removeLocalPost = (id) => {
    setPosts(posts.filter(p => p.id !== id));
  };

  return (
    <div className="h-full w-full bg-[#F4F6F8] dark:bg-gray-900 flex flex-col relative transition-colors">
      
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 py-4 flex flex-col gap-4 z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Feed</h1>
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] bg-gradient-to-tr from-chatverse to-purple-500 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 uppercase shadow-md">
            {currentUser.username?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 relative">
            <input 
              type="text" value={newPost} onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?" 
              className="w-full bg-gray-100/80 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-full px-5 py-3 text-[15px] font-medium focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-100 transition-all border border-transparent"
            />
          </div>
          <button onClick={handleCreatePost} disabled={!newPost.trim()} className={`w-[42px] h-[42px] rounded-full flex items-center justify-center transition-all flex-shrink-0 ${newPost.trim() ? 'bg-chatverse text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-5">
        {loading ? ( 
          <div className="flex flex-col gap-5 px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-[24px] shadow-sm flex flex-col gap-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex flex-col gap-2">
                    <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div className="w-16 h-2 bg-gray-100 dark:bg-gray-600 rounded-full"></div>
                  </div>
                </div>
                <div className="w-full h-16 bg-gray-100 dark:bg-gray-700 rounded-xl mt-2"></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? ( 
          <div className="h-full flex flex-col items-center justify-center text-center px-8 pb-10">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <ImageIcon className="w-10 h-10 text-indigo-300 dark:text-gray-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Posts Yet</h2>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 font-medium">Be the first to share your thoughts!</p>
          </div>
        ) : ( 
          posts.map((post) => <PostItem key={post.id} post={post} onPostUpdate={updateLocalPost} onPostDelete={removeLocalPost} />) 
        )}
      </div>
      <BottomNav />
    </div>
  );
}