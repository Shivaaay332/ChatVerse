import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, MoreVertical, Trash2, Edit3, Copy, Image as ImageIcon, X, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import api from '../api';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../api';

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

// UNIVERSAL POST COMPONENT
export const PostItem = ({ post, onPostUpdate, onPostDelete, isModal = false, onClose }) => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || { unique_id: '' };
  const isMyPost = post.unique_id === currentUser.unique_id;

  const [liked, setLiked] = useState(post.has_liked === true || post.has_liked === 'true');
  const [likeCount, setLikeCount] = useState(Number(post.like_count) || 0); 
  const [commentCount, setCommentCount] = useState(Number(post.comment_count) || 0);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef(null);
  
  const [replyingTo, setReplyingTo] = useState(null); 
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likedUsers, setLikedUsers] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  // FIX: Smart Navigation (Khud ki profile par click kiya toh seedha "My Profile" open hogi)
  const handleProfileClick = (id, username) => {
    if (onClose) onClose(); // Close modal if navigating
    if (id === currentUser.unique_id) {
      navigate('/profile');
    } else {
      navigate(`/user/${id}`, { state: { user: { unique_id: id, username: username } } });
    }
  };

  const handleLikeToggle = async () => {
    const prevLiked = liked;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? likeCount - 1 : likeCount + 1);
    try { await api.post(`/posts/${post.id}/like`); } 
    catch (error) { setLiked(prevLiked); setLikeCount(prevLiked ? likeCount : likeCount - 1); }
  };

  const fetchPostLikes = async () => {
    setShowLikesModal(true);
    setLikesLoading(true);
    try {
      const res = await api.get(`/posts/${post.id}/likes`);
      setLikedUsers(res.data);
    } catch(err) { console.error(err); }
    setLikesLoading(false);
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
      const parentId = replyingTo ? replyingTo.id : null;
      setNewComment('');
      setCommentCount(commentCount + 1);
      
      const res = await api.post(`/posts/${post.id}/comments`, { comment: text, parent_id: parentId });
      setComments([...comments, { 
        id: res.data.id, comment: text, username: currentUser.username, 
        unique_id: currentUser.unique_id, is_verified: currentUser.is_verified, parent_id: parentId, created_at: res.data.created_at, has_liked: false, like_count: 0 
      }]);
      setReplyingTo(null);
    } catch (error) { alert("Failed to add comment"); }
  };

  const handleCommentLike = async (commentId, isLiked) => {
    setComments(comments.map(c => c.id === commentId ? { ...c, has_liked: !isLiked, like_count: isLiked ? Number(c.like_count) - 1 : Number(c.like_count) + 1 } : c));
    try { await api.post(`/comments/${commentId}/like`); } 
    catch(err) { setComments(comments.map(c => c.id === commentId ? { ...c, has_liked: isLiked, like_count: isLiked ? Number(c.like_count) + 1 : Number(c.like_count) - 1 } : c)); }
  };

  const handleDeleteComment = async (commentId) => {
    if(window.confirm("Are you sure you want to delete this comment?")) {
      try {
        await api.delete(`/comments/${commentId}`);
        setComments(comments.filter(c => c.id !== commentId && c.parent_id !== commentId));
        setCommentCount(prev => prev - 1);
      } catch (err) { alert("Failed to delete comment"); }
    }
  };

  const handleEditCommentSave = async (commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await api.put(`/comments/${commentId}`, { comment: editCommentText });
      setComments(comments.map(c => c.id === commentId ? { ...c, comment: editCommentText } : c));
      setEditingCommentId(null);
    } catch(err) { alert("Failed to edit comment"); }
  };

  const initiateReply = (comment) => {
    setReplyingTo({ id: comment.parent_id || comment.id, username: comment.username });
    setNewComment(`@${comment.username} `);
    commentInputRef.current?.focus();
  };

  const renderComment = (c, isReply = false) => {
    const isCommentAuthor = c.unique_id === currentUser.unique_id;
    return (
      <div key={c.id} className={`flex gap-2.5 group ${isReply ? 'ml-9 mt-1 border-l-2 border-gray-100 dark:border-gray-700 pl-3' : ''}`}>
        <div onClick={() => handleProfileClick(c.unique_id, c.username)} className="w-8 h-8 rounded-full bg-gradient-to-tr from-chatverse to-purple-500 flex items-center justify-center text-white font-bold text-[11px] cursor-pointer shrink-0 mt-1 uppercase">
          {c.username?.charAt(0) || 'U'}
        </div>
        <div className="flex-1">
          {editingCommentId === c.id ? (
            <div className="mt-1">
              <input 
                type="text" 
                value={editCommentText} 
                onChange={(e) => setEditCommentText(e.target.value)} 
                className="w-full bg-white dark:bg-gray-700 border border-indigo-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-[13px] focus:outline-none dark:text-white" 
              />
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => handleEditCommentSave(c.id)} className="text-[11px] bg-chatverse text-white px-2 py-0.5 rounded font-semibold shadow-sm">Save</button>
                <button onClick={() => setEditingCommentId(null)} className="text-[11px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white px-2 py-0.5 rounded font-semibold transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-700 px-3.5 py-2.5 rounded-[16px] rounded-tl-[4px] shadow-sm border border-gray-50 dark:border-gray-600 w-fit max-w-full break-words">
              <span onClick={() => handleProfileClick(c.unique_id, c.username)} className="font-bold text-[15px] text-gray-900 dark:text-gray-100 cursor-pointer hover:underline pr-2 flex items-center gap-1">
                {c.username}
                {c.is_verified && <BadgeCheck className="w-[14px] h-[14px] text-[#1d9bf0] shrink-0" />}
              </span>
              <span className="text-[14px] text-gray-800 dark:text-gray-200 leading-snug block">{c.comment}</span>
            </div>
          )}
          
          {editingCommentId !== c.id && (
            <div className="flex items-center gap-4 mt-1.5 ml-2 text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
              <span>{timeAgo(c.created_at)}</span>
              <button onClick={() => handleCommentLike(c.id, c.has_liked)} className={`hover:text-gray-800 dark:hover:text-white transition-colors ${c.has_liked ? 'text-red-500 hover:text-red-600' : ''}`}>
                {c.like_count > 0 ? `${c.like_count} likes` : 'Like'}
              </button>
              <button onClick={() => initiateReply(c)} className="hover:text-gray-800 dark:hover:text-white transition-colors">Reply</button>
              
              {isCommentAuthor && (
                <button onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.comment); }} className="hover:text-gray-800 dark:hover:text-white transition-colors">Edit</button>
              )}
              
              {(isCommentAuthor || isMyPost) && (
                <button onClick={() => handleDeleteComment(c.id)} className="text-red-400 hover:text-red-500 transition-colors">Delete</button>
              )}
            </div>
          )}
        </div>
        <button onClick={() => handleCommentLike(c.id, c.has_liked)} className="mt-4 shrink-0 px-2 h-fit">
           <Heart className={`w-[14px] h-[14px] transition-transform ${c.has_liked ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-300 hover:text-gray-500 dark:hover:text-gray-400'}`} />
        </button>
      </div>
    );
  };

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    try {
      await api.put(`/posts/${post.id}`, { content: editContent });
      if (onPostUpdate) onPostUpdate(post.id, editContent); 
      setIsEditing(false);
    } catch (err) { alert("Error saving edit"); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(post.content);
    setShowMenu(false);
    alert("Text copied!");
  };

  const handleDeletePost = async () => {
    if(window.confirm("Permanently delete this post?")) {
      try {
        await api.delete(`/posts/${post.id}`);
        setShowMenu(false);
        if (onPostDelete) onPostDelete(post.id); 
      } catch (err) { alert("Error deleting"); }
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 transition-all ${isModal ? 'w-full rounded-[24px] shadow-2xl border border-gray-100 dark:border-gray-700 relative' : 'mb-3 mx-3 p-4 rounded-[20px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none border border-gray-50 dark:border-gray-700'}`}>
      
      {/* HEADER */}
      <div className={`flex justify-between items-center ${isModal ? 'px-5 py-4 border-b border-gray-50 dark:border-gray-700/60' : 'mb-4'}`}>
        <div onClick={() => handleProfileClick(post.unique_id, post.username)} className="flex items-center gap-3.5 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full p-[2px] shadow-sm">
            <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-900 dark:text-white font-bold text-[15px] uppercase">
              {post.username?.charAt(0) || 'U'}
            </div>
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-gray-900 dark:text-white text-[15px] flex items-center gap-1">
              {post.username}
              {post.is_verified && <BadgeCheck className="w-[15px] h-[15px] text-[#1d9bf0]" />}
            </h3>
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        
        {/* MENU */}
        <div className="relative flex items-center gap-1">
          {/* 3-Dot Button */}
          <button 
            onClick={() => setShowMenu(!showMenu)} 
            className="text-gray-400 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors relative z-[60]"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {onClose && (
            <button onClick={onClose} className="p-1.5 ml-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors relative z-[60]">
              <X className="w-5 h-5"/>
            </button>
          )}

          {/* FIX: INVISIBLE OVERLAY TO CLOSE MENU WHEN CLICKING OUTSIDE */}
          {showMenu && (
            <div 
              className="fixed inset-0 z-[50]" 
              onClick={(e) => { 
                e.stopPropagation(); 
                setShowMenu(false); 
              }}
            ></div>
          )}

          {/* DROPDOWN MENU */}
          {showMenu && (
            <div className="absolute right-0 top-10 w-44 bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[60] animate-slide-up">
              <button 
                onClick={(e) => { e.stopPropagation(); handleCopy(); }} 
                className="w-full text-left px-4 py-3.5 text-[14px] text-gray-700 dark:text-gray-200 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition-colors"
              >
                <Copy className="w-[18px] h-[18px]"/> Copy Text
              </button>
              
              {isMyPost && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowMenu(false); }} 
                    className="w-full text-left px-4 py-3.5 text-[14px] text-indigo-600 dark:text-indigo-400 flex items-center gap-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold transition-colors border-t border-gray-50 dark:border-gray-700"
                  >
                    <Edit3 className="w-[18px] h-[18px]"/> Edit Post
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeletePost(); }} 
                    className="w-full text-left px-4 py-3.5 text-[14px] text-red-500 flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors border-t border-gray-50 dark:border-gray-700"
                  >
                    <Trash2 className="w-[18px] h-[18px]"/> Delete Post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* POST CONTENT */}
      <div className={isModal ? 'px-5 py-4' : 'py-1 px-1'}>
        {isEditing ? (
          <div>
             <textarea
               value={editContent} onChange={(e) => setEditContent(e.target.value)}
               className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-chatverse transition-all resize-none text-[15px]" rows="3"
             />
             <div className="flex justify-end gap-2 mt-2">
               <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 text-[13px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
               <button onClick={handleEditSave} className="px-4 py-1.5 text-[13px] font-bold bg-chatverse text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Save</button>
             </div>
          </div>
        ) : (
          <p className="text-gray-800 dark:text-gray-200 text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{post.content}</p>
        )}
      </div>
      
      {/* INTERACTION BAR */}
      <div className={`flex items-center gap-6 ${isModal ? 'px-5 py-4 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/50' : 'mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60'}`}>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (window.navigator?.vibrate) window.navigator.vibrate(10); 
              handleLikeToggle();
            }} 
            className={`transition-all active:scale-75 ${liked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'}`}
          >
            <Heart className={`w-6 h-6 transition-transform ${liked ? 'fill-red-500 scale-[1.15]' : ''}`} /> 
          </button>
          <span onClick={fetchPostLikes} className={`text-[14px] font-bold ${likeCount > 0 ? 'cursor-pointer hover:underline text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
            {likeCount} {likeCount === 1 ? 'like' : 'likes'}
          </span>
        </div>

        <button onClick={toggleComments} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-chatverse transition-colors">
          <MessageCircle className="w-6 h-6" /> 
          <span className="text-[14px] font-bold">{commentCount} comments</span>
        </button>
      </div>

      {/* LIKES MODAL */}
      {showLikesModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setShowLikesModal(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-[340px] rounded-[24px] shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-black text-lg text-gray-900 dark:text-white">Likes</h3>
              <button onClick={() => setShowLikesModal(false)} className="p-1.5 text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto no-scrollbar p-2 pb-4">
              {likesLoading ? <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-chatverse border-t-transparent rounded-full animate-spin"></div></div>
              : likedUsers.length === 0 ? <div className="py-8 text-center text-[14px] font-medium text-gray-500">No likes yet.</div> 
              : likedUsers.map(u => (
                <div key={u.unique_id} onClick={() => handleProfileClick(u.unique_id, u.username)} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-2xl cursor-pointer transition-colors">
                  <div className="text-[14px] bg-gradient-to-tr from-chatverse to-purple-500 rounded-full flex items-center justify-center text-white font-bold uppercase shadow-sm shrink-0">{u.username.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white text-[15px] flex items-center gap-1">
                      {u.username}
                      {u.is_verified && <BadgeCheck className="w-[14px] h-[14px] text-[#1d9bf0]" />}
                    </p>
                    <p className="text-[12.5px] text-gray-500 font-medium">@{u.unique_id}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COMMENTS AREA */}
      {showComments && (
        <div className={`animate-slide-down bg-gray-50/50 dark:bg-gray-800/50 ${isModal ? 'p-4 border-t border-gray-100 dark:border-gray-700/60' : 'mt-4 p-4 rounded-[20px] border border-gray-100 dark:border-gray-700'}`}>
          {loadingComments ? (
            <div className="py-4 flex justify-center"><div className="w-5 h-5 border-2 border-chatverse border-t-transparent rounded-full animate-spin"></div></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 font-medium py-2">No comments yet. Start the conversation!</p>
          ) : (
            <div className="flex flex-col gap-4 mb-4 max-h-[300px] overflow-y-auto no-scrollbar pb-2">
              {comments.filter(c => !c.parent_id).map(topComment => (
                <div key={topComment.id} className="flex flex-col gap-1">
                  {renderComment(topComment, false)}
                  {comments.filter(reply => reply.parent_id === topComment.id).map(replyComment => (
                    renderComment(replyComment, true)
                  ))}
                </div>
              ))}
            </div>
          )}

          {replyingTo && (
            <div className="bg-indigo-50/80 dark:bg-indigo-900/30 px-4 py-2 border-l-4 border-chatverse flex justify-between items-center text-[12px] mb-2 mx-1 rounded-r-lg shadow-sm">
               <span className="text-gray-600 dark:text-indigo-200 font-medium">Replying to <span className="font-bold text-chatverse dark:text-indigo-300">@{replyingTo.username}</span></span>
               <button onClick={() => { setReplyingTo(null); setNewComment(''); }} className="text-gray-500 hover:text-gray-800 dark:hover:text-white p-1 rounded-full"><X className="w-4 h-4"/></button>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1 relative">
            <input 
              ref={commentInputRef} type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyingTo ? "Write a reply..." : "Write a comment..."} 
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
  const [posts, setPosts] = useState(() => {
    const cached = localStorage.getItem('chatverse_cached_posts');
    return cached ? JSON.parse(cached) : [];
  });
  // Agar cache me data hai, toh loading screen kabhi nahi aayegi
  const [loading, setLoading] = useState(posts.length === 0);
  const [newPost, setNewPost] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || { username: 'Me' };

  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts');
      setPosts(res.data);
      localStorage.setItem('chatverse_cached_posts', JSON.stringify(res.data)); // Background Cache Update
    } catch (err) {
      console.error("Failed to fetch posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchPosts(); 
    
    // FIX: Silent connection on Home Feed (Without disconnecting!)
    const feedSocket = io(SOCKET_URL);
    if (currentUser.unique_id) {
      feedSocket.emit('join', currentUser.unique_id);
    }
  }, []);

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;
    try {
      await api.post('/posts', { content: newPost });
      setNewPost(''); 
      fetchPosts();   
    } catch (err) { alert("Error posting"); }
  };

  const updateLocalPost = (id, newContent) => { setPosts(posts.map(p => p.id === id ? { ...p, content: newContent } : p)); };
  const removeLocalPost = (id) => { setPosts(posts.filter(p => p.id !== id)); };

  return (
    <div className="h-full w-full bg-[#F4F6F8] dark:bg-gray-900 flex flex-col overflow-hidden relative transition-colors">
      <div className="bg-white/85 dark:bg-gray-800/85 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-3 z-20 shrink-0 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Feed</h1>
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

      <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar pb-24 pt-5">
        {loading ? ( 
          <div className="flex flex-col gap-5 px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-[24px] shadow-sm flex flex-col gap-4 animate-pulse">
                <div className="flex items-center gap-3"><div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-full"></div><div className="flex flex-col gap-2"><div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded-full"></div><div className="w-16 h-2 bg-gray-100 dark:bg-gray-600 rounded-full"></div></div></div>
                <div className="w-full h-16 bg-gray-100 dark:bg-gray-700 rounded-xl mt-2"></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? ( 
          <div className="h-full flex flex-col items-center justify-center text-center px-8 pb-10">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-5 shadow-inner"><ImageIcon className="w-10 h-10 text-indigo-300 dark:text-gray-600" /></div>
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