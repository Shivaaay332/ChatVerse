import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MoreVertical, Send, Smile, Check, CheckCheck, Clock, Trash2, X, Reply, Star, Copy, BellOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';
import { SOCKET_URL } from '../api';

export default function ChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const friendName = location.state?.name || "Friend";
  const receiverId = location.state?.id || "demo_id"; 
  
  const currentUser = JSON.parse(localStorage.getItem('chatverse_user')) || { unique_id: 'my_id' };
  
  const hideReadReceipts = localStorage.getItem('chatverse_hide_readreceipts') === 'true';
  const hideLastSeen = localStorage.getItem('chatverse_hide_lastseen') === 'true';

  // Privacy Settings
  const isMuted = localStorage.getItem(`cv_mute_${receiverId}`) === 'true';
  const hasCustomPrivacy = localStorage.getItem(`cv_privacy_${receiverId}`) === 'true';

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactId, setActiveReactId] = useState(null);
  const emojis = ['❤️','😂','😲','😢','🙏','👍','🔥','✨'];
  
  // NEW: Swipe-to-Reply States
  const [swipingId, setSwipingId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartRef = useRef({ x: 0, y: 0 });

  const endOfMessagesRef = useRef(null);
  const pressTimer = useRef(null);
  const longPressTriggered = useRef(false); // NEW: Long-Press Bug Fix Flag
  const [socket, setSocket] = useState(null);

  const formatTime = (dateString) => {
    if (!dateString) return 'Now';
    const safeDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    const date = new Date(safeDateString);
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true
    });
  };

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.emit('join', currentUser.unique_id);

    api.get(`/messages/${receiverId}`).then(res => setMessages(res.data)).catch(err => console.log(err));

    newSocket.on('receive_message', (newMsg) => {
      if (newMsg.sender_id === receiverId) {
        setMessages((prev) => [...prev, newMsg]);
        if (!isMuted) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2357/2357-84.wav');
            audio.volume = 0.4;
            audio.play();
          } catch(e){}
        }
        if (!hideReadReceipts) {
          newSocket.emit('mark_as_read', { messageId: newMsg.id, senderId: receiverId });
        }
      }
    });

    newSocket.on('message_status', ({ tempId, status, realId }) => {
      setMessages((prev) => prev.map(msg => msg.tempId === tempId ? { ...msg, status, id: realId } : msg));
    });

    newSocket.on('message_updated', (updatedData) => {
      setMessages((prev) => prev.map(msg => msg.id === updatedData.id ? { ...msg, ...updatedData } : msg));
    });

    let typingTimeout;
    newSocket.on('typing', (senderId) => {
      if (senderId === receiverId) {
        setIsTyping(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => setIsTyping(false), 2000);
      }
    });

    return () => newSocket.disconnect();
  }, [receiverId, currentUser.unique_id, hideReadReceipts, isMuted]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (socket && !hasCustomPrivacy) {
      socket.emit('typing', { senderId: currentUser.unique_id, receiverId });
    }
  };

  const handleSend = () => {
    if (message.trim() === '') return;
    const tempId = Date.now().toString();
    const newMsg = {
      tempId, id: tempId, sender_id: currentUser.unique_id, receiver_id: receiverId, content: message,
      status: 'sending', created_at: new Date().toISOString(), reaction: null, is_deleted_for_everyone: false, is_deleted_for_me: false,
      reply_to_id: replyingTo ? replyingTo.id : null, reply_content: replyingTo ? replyingTo.content : null
    };

    setMessages((prev) => [...prev, newMsg]);
    setMessage('');
    setShowEmojiPicker(false);
    
    const replyIdToSend = replyingTo ? replyingTo.id : null;
    setReplyingTo(null);

    if (socket) {
      socket.emit('send_message', { tempId, senderId: currentUser.unique_id, receiverId, content: newMsg.content, replyToId: replyIdToSend });
    }
  };

  const toggleSelection = (msg) => {
    if (msg.is_deleted_for_everyone) return;
    setSelectedMessages(prev => 
      prev.some(m => m.id === msg.id) ? prev.filter(m => m.id !== msg.id) : [...prev, msg]
    );
  };

  // UPDATED: Gesture Handlers for Long-Press & Swipe-to-Reply
  const handlePointerDown = (e, msg) => {
    if (msg.is_deleted_for_everyone) return;
    
    longPressTriggered.current = false; // Reset flag on touch start
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    setSwipingId(msg.id);
    setSwipeOffset(0);

    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true; // Mark as long-pressed
      if (selectedMessages.length === 0) {
        toggleSelection(msg);
        setSwipingId(null); 
        if (window.navigator?.vibrate) window.navigator.vibrate(50); 
      }
    }, 450); 
  };

  const handlePointerMove = (e, msg) => {
    if (swipingId !== msg.id || selectedMessages.length > 0) return;
    
    const deltaX = e.clientX - swipeStartRef.current.x;
    const deltaY = Math.abs(e.clientY - swipeStartRef.current.y);

    if ((Math.abs(deltaX) > 10 || deltaY > 10) && pressTimer.current) clearTimeout(pressTimer.current);
    if (deltaY > 20 && swipeOffset < 20) { setSwipingId(null); setSwipeOffset(0); return; }
    if (deltaX > 0) setSwipeOffset(Math.min(deltaX, 75)); 
  };

  const handlePointerUpOrLeave = (e, msg) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    
    if (swipingId === msg.id) {
      if (swipeOffset >= 45) { 
        setReplyingTo(msg);
        if (window.navigator?.vibrate) window.navigator.vibrate(50);
      }
      setSwipingId(null);
      setSwipeOffset(0);
    }
  };

  const handleInlineReaction = (msgId, emoji) => {
    setMessages(messages.map(msg => msg.id === msgId ? { ...msg, reaction: emoji } : msg));
    if (socket) socket.emit('react_message', { messageId: msgId, reaction: emoji, receiverId });
    setActiveReactId(null);
  };

  const handleStarMessages = () => {
    const ids = selectedMessages.map(m => m.id);
    setMessages(messages.map(msg => ids.includes(msg.id) ? { ...msg, is_starred: !msg.is_starred } : msg));
    setSelectedMessages([]);
  };

  const handleDeleteForMe = async () => {
    try {
      const ids = selectedMessages.map(m => m.id);
      for (const id of ids) await api.delete(`/messages/forme/${id}`);
      setMessages(messages.map(msg => ids.includes(msg.id) ? { ...msg, is_deleted_for_me: true } : msg));
      setSelectedMessages([]);
    } catch (error) { console.error(error); }
  };

  const handleDeleteForEveryone = () => {
    const ids = selectedMessages.filter(m => m.sender_id === currentUser.unique_id).map(m => m.id);
    setMessages(messages.map(msg => ids.includes(msg.id) ? { ...msg, content: "This message was deleted", is_deleted_for_everyone: true } : msg));
    if (socket) {
      ids.forEach(id => socket.emit('delete_message_everyone', { messageId: id, receiverId }));
    }
    setSelectedMessages([]);
  };

  const handleScreenClick = (e) => {
    if (activeReactId) setActiveReactId(null);
    if (showMenu) setShowMenu(false);
  };

  // Pre-calculations for Unread Divider
  const visibleMessages = messages.filter(m => !m.is_deleted_for_me);
  const firstUnreadIndex = visibleMessages.findIndex(m => m.sender_id === receiverId && m.status !== 'read');
  const unreadCount = visibleMessages.filter(m => m.sender_id === receiverId && m.status !== 'read').length;

  return (
    <div className="h-full w-full bg-[#F0F2F5] dark:bg-gray-900 flex flex-col relative transition-colors" onClick={handleScreenClick}>
      
      {/* Top Action Bar for Selected Messages */}
      {selectedMessages.length > 0 ? (
        <div className="bg-chatverse text-white px-4 py-3 shadow-md flex justify-between items-center z-50 sticky top-0 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedMessages([])} className="hover:bg-white/20 p-1.5 rounded-full"><X className="w-6 h-6" /></button>
            <span className="font-bold text-lg">{selectedMessages.length}</span>
          </div>
          <div className="flex items-center gap-3">
            {selectedMessages.length === 1 && (
              <button onClick={() => { setReplyingTo(selectedMessages[0]); setSelectedMessages([]); }} className="p-2 hover:bg-white/20 rounded-full"><Reply className="w-5 h-5" /></button>
            )}
            <button onClick={handleStarMessages} className="p-2 hover:bg-white/20 rounded-full"><Star className="w-5 h-5" /></button>
            <button onClick={() => { navigator.clipboard.writeText(selectedMessages.map(m => m.content).join('\n')); setSelectedMessages([]); }} className="p-2 hover:bg-white/20 rounded-full"><Copy className="w-5 h-5" /></button>
            <button onClick={handleDeleteForMe} className="p-2 hover:bg-white/20 rounded-full"><Trash2 className="w-5 h-5" /></button>
            {selectedMessages.every(m => m.sender_id === currentUser.unique_id) && (
              <button onClick={handleDeleteForEveryone} className="p-2 text-red-300 hover:text-red-100 hover:bg-white/20 rounded-full"><Trash2 className="w-5 h-5"/></button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md px-4 py-3 shadow-sm flex justify-between items-center z-50 sticky top-0 border-b border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"><ArrowLeft className="w-6 h-6" /></button>
            <div onClick={() => navigate(`/user/${receiverId}`, { state: { user: { unique_id: receiverId, username: friendName } } })} className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold uppercase shadow-sm">{friendName.charAt(0)}</div>
              <div className="flex flex-col">
                <h2 className="font-bold text-gray-900 dark:text-white text-[15px] hover:underline flex items-center gap-1">
                  {friendName}
                  {isMuted && <BellOff className="w-3.5 h-3.5 text-red-400" />}
                </h2>
                {isTyping ? <span className="text-[11px] text-chatverse dark:text-indigo-400 font-bold italic animate-pulse">typing...</span> 
                 : (!hideLastSeen && <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Online</span>)}
              </div>
            </div>
          </div>
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><MoreVertical className="w-5 h-5" /></button>
            {showMenu && (
              <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[100]">
                <button onClick={() => { setMessages([]); setShowMenu(false); api.delete(`/chats/${receiverId}`); }} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold transition-colors">Clear Chat Now</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-3 py-6 flex flex-col no-scrollbar">
        {visibleMessages.map((msg, idx) => {
          const isMe = msg.sender_id === currentUser.unique_id;
          const isSelected = selectedMessages.some(m => m.id === msg.id);
          const hasReaction = !!msg.reaction;

          return (
            <div key={msg.id || idx} className={`w-full flex flex-col ${activeReactId === msg.id ? 'relative z-40' : 'relative z-0'}`}>
              
              {/* Unread Messages WhatsApp-style Divider */}
              {idx === firstUnreadIndex && unreadCount > 0 && (
                <div className="w-full flex justify-center my-4 relative z-0">
                  <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-chatverse dark:text-indigo-400 text-[11px] font-black px-4 py-1.5 rounded-full z-10">
                    {unreadCount} UNREAD MESSAGE{unreadCount > 1 ? 'S' : ''}
                  </div>
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gray-200 dark:bg-gray-700/50 z-0"></div>
                </div>
              )}

              {/* Dynamic margin bottom */}
              <div className={`flex w-full ${hasReaction ? 'mb-[22px]' : 'mb-1.5'} group ${isMe ? 'justify-end' : 'justify-start'}`}>
                
                {/* Quick Actions (For Me) -> Sirf Smile Button rakha hai */}
                {isMe && !msg.is_deleted_for_everyone && (
                  <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                    <button onClick={(e) => { e.stopPropagation(); setActiveReactId(msg.id); }} className="p-1.5 text-gray-400 hover:text-chatverse rounded-full"><Smile className="w-[18px] h-[18px]"/></button>
                  </div>
                )}

                {/* Main Wrapper Box to handle the Swipe Layout perfectly */}
                <div className="relative max-w-[80%] flex flex-col">
                  
                  {/* The Reveal Swipe Reply Icon */}
                  {swipingId === msg.id && (
                    <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center bg-black/10 dark:bg-white/10 rounded-full w-[28px] h-[28px] z-10"
                         style={{ left: '-6px', opacity: Math.min(swipeOffset / 40, 1), transform: `scale(${Math.min(swipeOffset / 40, 1)})` }}>
                      <Reply className="w-[14px] h-[14px] text-gray-600 dark:text-gray-300" />
                    </div>
                  )}

                  {/* The Moving Bubble Layer */}
                  <div className="relative flex flex-col z-20"
                       style={{ transform: swipingId === msg.id ? `translateX(${swipeOffset}px)` : 'translateX(0px)', transition: swipingId === msg.id ? 'none' : 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)', touchAction: 'pan-y' }}>
                    
                    {/* Main Message Bubble */}
                    <div 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (longPressTriggered.current) { longPressTriggered.current = false; return; }
                        if (selectedMessages.length > 0) toggleSelection(msg); 
                      }}
                      onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); handlePointerDown(e, msg); }}
                      onPointerMove={(e) => { e.stopPropagation(); handlePointerMove(e, msg); }}
                      onPointerUp={(e) => { e.stopPropagation(); e.currentTarget.releasePointerCapture?.(e.pointerId); handlePointerUpOrLeave(e, msg); }}
                      onPointerLeave={(e) => { e.stopPropagation(); handlePointerUpOrLeave(e, msg); }}
                      className={`relative px-2.5 pt-1.5 pb-1 shadow-sm cursor-pointer transition-all select-none ${
                        isSelected ? 'bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-400 rounded-2xl' :
                        msg.is_deleted_for_everyone ? 'bg-white/60 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 italic border border-gray-200 dark:border-gray-700 rounded-[18px]' 
                        : isMe ? 'bg-chatverse text-white rounded-[18px] rounded-tr-[4px]' 
                        : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-[18px] rounded-tl-[4px]'
                      }`}
                    >
                      
                      {/* Replied Content Banner */}
                      {msg.reply_content && !msg.is_deleted_for_everyone && (
                        <div className={`mb-1 px-2.5 py-1.5 rounded-lg text-[13px] line-clamp-1 border-l-4 ${isMe ? 'bg-indigo-700/30 border-white/70 text-indigo-50' : 'bg-gray-100 dark:bg-gray-700 border-chatverse text-gray-600 dark:text-gray-300'}`}>
                          {msg.reply_content}
                        </div>
                      )}
                      
                      {/* 100% PERFECT WHATSAPP-STYLE SAFE CONTAINER */}
                      <div className="relative text-[15px] leading-[1.4] break-words">
                        <span>{msg.content}</span>
                        
                        {/* INVISIBLE SPACER: Time ko jagah dene ke liye ye space line break force karega */}
                        {!msg.is_deleted_for_everyone && (
                          <span className={`inline-block h-[12px] ${isMe ? 'w-[75px]' : 'w-[52px]'}`}></span>
                        )}
                      </div>

                      {/* Timestamp safely locked at the absolute bottom-right corner inside the bubble */}
                      {!msg.is_deleted_for_everyone && (
                        <div className={`absolute bottom-1 right-2 flex items-center gap-[3px] text-[10px] font-medium select-none ${isMe ? 'text-indigo-100/90' : 'text-gray-400 dark:text-gray-500'}`}>
                          {msg.is_starred && <Star className="w-[10px] h-[10px] fill-current mr-0.5" />}
                          <span className="leading-none">{formatTime(msg.created_at)}</span>
                          {isMe && (
                            <span className="flex items-center ml-0.5">
                              {msg.status === 'sending' && <Clock className="w-[10px] h-[10px]" />}
                              {msg.status === 'sent' && <Check className="w-[12px] h-[12px]" />}
                              {msg.status === 'delivered' && <CheckCheck className="w-[14px] h-[14px] text-indigo-200" />}
                              {msg.status === 'read' && <CheckCheck className="w-[14px] h-[14px] text-[#4ADE80]" />}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reaction Badge completely outside the bubble, perfectly aligned */}
                    {msg.reaction && !msg.is_deleted_for_everyone && (
                      <div className={`absolute -bottom-3.5 ${isMe ? 'right-4' : 'left-4'} bg-white dark:bg-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.15)] dark:border dark:border-gray-700 rounded-full px-[6px] py-[2px] text-[12px] z-30 select-none flex items-center justify-center`}>
                        {msg.reaction}
                      </div>
                    )}

                    {/* Inline Emoji Picker specifically for this message */}
                    {activeReactId === msg.id && (
                      <div onClick={(e) => e.stopPropagation()} className={`absolute z-50 bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 p-2 flex gap-2 rounded-[20px] animate-slide-up`}>
                        {emojis.map(emoji => (
                          <button key={emoji} onClick={() => handleInlineReaction(msg.id, emoji)} className="text-[20px] hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  
                  </div>
                </div>

                {/* Quick Actions (For Friend) -> Sirf Smile Button rakha hai */}
                {!isMe && !msg.is_deleted_for_everyone && (
                  <div className="flex items-center gap-1 pl-2 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                    <button onClick={(e) => { e.stopPropagation(); setActiveReactId(msg.id); }} className="p-1.5 text-gray-400 hover:text-chatverse rounded-full"><Smile className="w-[18px] h-[18px]"/></button>
                  </div>
                )}

              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="self-start max-w-[75%] mt-2 mb-2">
            <div className="px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[18px] rounded-tl-[4px] shadow-sm flex items-center gap-1.5 w-fit">
              <div className="w-1.5 h-1.5 bg-chatverse dark:bg-indigo-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-chatverse dark:bg-indigo-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-1.5 h-1.5 bg-chatverse dark:bg-indigo-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} className="h-4" />
      </div>

      {/* Input Field & Reply Banner Control */}
      <div className="bg-white dark:bg-gray-800 flex flex-col border-t border-gray-100/60 dark:border-gray-700 shadow-md z-10 relative">
        
        {/* Reply Context Banner */}
        {replyingTo && (
          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-l-4 border-chatverse flex justify-between items-center text-sm shadow-sm relative z-0">
             <div className="flex flex-col">
               <span className="text-chatverse dark:text-indigo-400 font-bold text-[13px]">Replying to {replyingTo.sender_id === currentUser.unique_id ? 'Yourself' : friendName}</span>
               <span className="text-gray-500 dark:text-gray-300 text-[12px] line-clamp-1">{replyingTo.content}</span>
             </div>
             <button onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white p-1"><X className="w-5 h-5"/></button>
          </div>
        )}

        {/* Global Emoji Picker (For input bar) */}
        {showEmojiPicker && (
          <div className="absolute bottom-[70px] left-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl rounded-[20px] p-4 grid grid-cols-4 gap-3 z-50 w-64 animate-slide-up">
            {emojis.map(e => (
              <button key={e} onClick={() => { setMessage(prev => prev + e); setShowEmojiPicker(false); }} className="text-[22px] hover:scale-125 transition-transform flex items-center justify-center">
                {e}
              </button>
            ))}
          </div>
        )}

        <div className="px-3 py-3 flex items-end gap-2 pb-4 z-10 bg-white dark:bg-gray-800">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} 
            className={`p-2.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-indigo-50 dark:bg-indigo-900/30 text-chatverse' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <Smile className="w-[22px] h-[22px]" />
          </button>

          <textarea 
            value={message} onChange={handleTyping} placeholder="Message..." 
            className="flex-1 max-h-28 bg-gray-100/80 dark:bg-gray-700 dark:text-white rounded-[20px] px-4 py-2.5 text-[15px] focus:outline-none resize-none placeholder-gray-400 dark:placeholder-gray-400" 
            rows="1" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
          />
          <button onClick={handleSend} disabled={!message.trim()} className={`p-3 rounded-full transition-all ${message.trim() ? 'bg-chatverse text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}