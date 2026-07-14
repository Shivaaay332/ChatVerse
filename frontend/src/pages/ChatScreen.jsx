import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MoreVertical, Send, Smile, Check, CheckCheck, Clock, Trash2, X, Reply, Star, Copy, BellOff, Palette, Music } from 'lucide-react';
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

  // 👇 NAYI LINE YAHAN ADD KARO 👇
  const hideOnline = localStorage.getItem('chatverse_hide_online') === 'true';

  const isMuted = localStorage.getItem(`cv_mute_${receiverId}`) === 'true';
  const hasCustomPrivacy = localStorage.getItem(`cv_privacy_${receiverId}`) === 'true';

  // Ultra Personalization States
  const [chatTheme, setChatTheme] = useState(localStorage.getItem(`cv_theme_${receiverId}`) || 'default');
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  // Real-time Status States
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenTime, setLastSeenTime] = useState('');

  const [selectedMessages, setSelectedMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactId, setActiveReactId] = useState(null);
  
  // Single line top 6 emojis (WhatsApp style)
  const reactionEmojis = ['❤️', '😂', '😲', '😢', '🙏', '👍'];
  
  // 2. Niche message likhte time use hone wale WhatsApp jaise dher saare emojis
  const chatEmojis = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','👍','👎','✊','👊','🤛','🤜','🤞','✌️','🫰','🤟','🤘','👌','🤌','🤏','🫳','🫴','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤙','🫲','🫱','💪','🦾','🖕','✍️','🙏','🫵','🦶','🦵','🦿','💄','💋','👄','🦷','👅','👂','🦻','👃','👣','👁','👀','🫀','🫁','🧠','🗣','👤','👥','🫂'
  ];
  
  // Swipe-to-Reply States
  const [swipingId, setSwipingId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartRef = useRef({ x: 0, y: 0 });

  const endOfMessagesRef = useRef(null);
  const typingTimeoutRef = useRef(null); // <-- YE NAYI LINE ADD KARNI HAI
  const isScrolledUpRef = useRef(false); 
  const [newMsgBadge, setNewMsgBadge] = useState(false); 
  const pressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [socket, setSocket] = useState(null);

  // MOBILE KEYBOARD VIEWPORT FIX
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.emit('join', currentUser.unique_id);

    // 1. ONLINE STATUS FIX: Isey direct emit karo bina on('connect') ke wait kiye
    // Socket.io isey automatic queue karke instant bhej dega!
    newSocket.emit('check_companion_status', { targetId: receiverId });

    api.get(`/messages/${receiverId}`).then(res => {
      const fetchedMessages = res.data;
      setMessages(fetchedMessages);

      // 2. BOTTOM SCROLL FIX: Chat khulte hi direct last message par bhej do
      setTimeout(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);

      if (!hideReadReceipts) {
        const unreadMsgs = fetchedMessages.filter(m => m.sender_id === receiverId && m.status !== 'read');
        if (unreadMsgs.length > 0) {
          setMessages(prev => prev.map(m => 
            (m.sender_id === receiverId && m.status !== 'read') ? { ...m, status: 'read' } : m
          ));
          unreadMsgs.forEach(msg => {
            newSocket.emit('mark_as_read', { messageId: msg.id, senderId: receiverId });
          });
        }
      }
    }).catch(err => console.log(err));

    newSocket.on('companion_status_result', (data) => {
      if (data.targetId === receiverId) {
        setIsOnline(data.isOnline);
        if (data.lastSeen) setLastSeenTime(data.lastSeen);
      }
    });

    newSocket.on('user_online', (uid) => {
      if (uid === receiverId) setIsOnline(true);
    });

    newSocket.on('user_offline', (data) => {
      const uid = typeof data === 'string' ? data : data?.userId;
      if (uid === receiverId) {
        setIsOnline(false);
        setLastSeenTime(data?.lastSeen || new Date().toISOString());
      }
    });

    newSocket.on('receive_message', (newMsg) => {
      if (newMsg.sender_id === receiverId) {
        
        setIsTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        const readMsg = { ...newMsg, status: 'read' };
        setMessages((prev) => [...prev, readMsg]);
        
        // FIX: Yahan pehle 'setIsOnline(true)' likha tha jisse privacy bypass ho rahi thi.
        // Uski jagah ab hum server se instantly check karenge ki usne status hide to nahi kiya hai!
        newSocket.emit('check_companion_status', { targetId: receiverId });
        
        if (!isMuted) {
          try {
            const tone = localStorage.getItem(`cv_sound_${receiverId}`) || 'default';
            let audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2357/2357-84.wav';
            if (tone === 'minimal') audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-84.wav';
            if (tone === 'retro') audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-84.wav';
            const audio = new Audio(audioSrc);
            audio.volume = 0.4;
            audio.play();
          } catch(e){}
        }

        if (!hideReadReceipts) {
          newSocket.emit('mark_as_read', { messageId: newMsg.id, senderId: receiverId });
        }

        if (!isScrolledUpRef.current) {
          setTimeout(() => endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          setNewMsgBadge(true); 
        }
      }
    });

    newSocket.on('typing', (senderId) => {
      if (senderId === receiverId) {
        setIsTyping(true);
        setIsOnline(true); 
        setLastSeenTime(new Date().toISOString()); 
        
        if (!isScrolledUpRef.current) {
          setTimeout(() => endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
      }
    });

    newSocket.on('message_status', ({ tempId, status, realId }) => {
      setMessages((prev) => prev.map(msg => msg.tempId === tempId ? { ...msg, status, id: realId } : msg));
    });

    newSocket.on('message_updated', (updatedData) => {
      setMessages((prev) => prev.map(msg => msg.id === updatedData.id ? { ...msg, ...updatedData } : msg));
    });

    newSocket.on('theme_updated', ({ themeId }) => {
      setChatTheme(themeId);
      localStorage.setItem(`cv_theme_${receiverId}`, themeId);
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      newSocket.disconnect();
    };
  }, [receiverId, currentUser.unique_id, hideReadReceipts, isMuted]);

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

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'recently';
    const safeDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    const date = new Date(safeDateString);
    const now = new Date();
    
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).getDate() === date.getDate() && now.getMonth() === date.getMonth();

    const time = date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    
    if (isToday) return `today at ${time}`;
    if (isYesterday) return `yesterday at ${time}`;
    return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${time}`;
  };

  // SMART SCROLL TO BOTTOM
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    const isUp = scrollHeight - scrollTop - clientHeight > 100;
    
    isScrolledUpRef.current = isUp;
    setShowScrollButton(isUp);
    
    if (!isUp) setNewMsgBadge(false); // Niche aate hi badge hata do
  };

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to Replied Message Logic
  const scrollToMessage = (msgId) => {
    if (!msgId) return;
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Bubble Highlight Effect
      const bubble = element.querySelector('.message-bubble');
      if (bubble) {
        bubble.classList.add('ring-4', 'ring-indigo-300', 'dark:ring-indigo-500', 'scale-[1.02]', 'transition-all', 'duration-500');
        setTimeout(() => {
          bubble.classList.remove('ring-4', 'ring-indigo-300', 'dark:ring-indigo-500', 'scale-[1.02]');
        }, 1200);
      }
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    // Auto-Resize Textarea Logic
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;

    // FIX: Agar user ne "Hide Online" ON rakha hai, to Typing animation math bhejo
    if (socket && !hasCustomPrivacy && !hideOnline) {
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

    const textarea = document.getElementById('chat-input');
    if (textarea) textarea.style.height = 'auto';
    
    const replyIdToSend = replyingTo ? replyingTo.id : null;
    setReplyingTo(null);

    if (socket) {
      socket.emit('send_message', { tempId, senderId: currentUser.unique_id, receiverId, content: newMsg.content, replyToId: replyIdToSend });
    }

    // FIX YAHAN HAI: Message send karte hi turant screen ko bottom par scroll kar do
    setTimeout(() => {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
      isScrolledUpRef.current = false; // System ko bata do ki ab hum bottom par aa chuke hain
    }, 50);
  };

  const toggleSelection = (msg) => {
    if (msg.is_deleted_for_everyone) return;
    setSelectedMessages(prev => prev.some(m => m.id === msg.id) ? prev.filter(m => m.id !== msg.id) : [...prev, msg]);
  };

  const handlePointerDown = (e, msg) => {
    if (msg.is_deleted_for_everyone) return;
    longPressTriggered.current = false;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    setSwipingId(msg.id);
    setSwipeOffset(0);

    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
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
        setTimeout(() => document.getElementById('chat-input')?.focus(), 50);
      }
      setSwipingId(null);
      setSwipeOffset(0);
    }
  };

  const handleInlineReaction = (msgId, emoji) => {
    const targetMsg = messages.find(m => m.id === msgId);
    // Remove if clicked again
    const newReaction = (targetMsg && targetMsg.reaction === emoji) ? null : emoji;

    setMessages(messages.map(msg => msg.id === msgId ? { ...msg, reaction: newReaction } : msg));
    if (socket) socket.emit('react_message', { messageId: msgId, reaction: newReaction, receiverId });
    setActiveReactId(null);
  };

  const handleStarMessages = () => {
    const ids = selectedMessages.map(m => m.id);
    setMessages(messages.map(msg => ids.includes(msg.id) ? { ...msg, is_starred: !msg.is_starred } : msg));
    setSelectedMessages([]);
  };

  const handleDeleteForMe = async (messageId) => {
    const previousMessages = [...messages]; 
    setMessages((prev) => prev.filter(msg => msg.id !== messageId));
    setSelectedMessages([]);
    try {
      await api.delete(`/messages/forme/${messageId}`);
    } catch (err) {
      console.error("Delete failed, reverting UI");
      setMessages(previousMessages);
      alert("Failed to delete message. Please try again.");
    }
  };

  const handleDeleteForEveryone = () => {
    const ids = selectedMessages.filter(m => m.sender_id === currentUser.unique_id).map(m => m.id);
    setMessages(messages.map(msg => ids.includes(msg.id) ? { ...msg, content: "This message was deleted", is_deleted_for_everyone: true } : msg));
    if (socket) {
      ids.forEach(id => socket.emit('delete_message_everyone', { messageId: id, receiverId }));
    }
    setSelectedMessages([]);
  };

  // Screen Clicks dismissing everything instantly
  const handleScreenClick = (e) => {
    if (activeReactId) setActiveReactId(null);
    if (showMenu) setShowMenu(false);
    if (showEmojiPicker) setShowEmojiPicker(false);
  };

  const applyTheme = (themeId) => {
    setChatTheme(themeId);
    localStorage.setItem(`cv_theme_${receiverId}`, themeId);
    if (socket) socket.emit('change_chat_theme', { themeId, senderId: currentUser.unique_id, receiverId });
    setShowThemeModal(false);
  };

  const testAndSetSound = (toneId) => {
    let audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2357/2357-84.wav';
    if (toneId === 'minimal') audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-84.wav';
    if (toneId === 'retro') audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-84.wav';
    
    const audio = new Audio(audioSrc);
    audio.volume = 0.5;
    audio.play();

    localStorage.setItem(`cv_sound_${receiverId}`, toneId);
    setShowSoundModal(false);
  };

  const getThemeClasses = () => {
    if (chatTheme === 'sunset') return 'bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-950/50 dark:to-orange-950/50';
    if (chatTheme === 'emerald') return 'bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/50 dark:to-teal-900/50';
    if (chatTheme === 'midnight') return 'bg-gradient-to-br from-indigo-100 to-purple-200 dark:from-indigo-950/50 dark:to-purple-950/50';
    // 2 NAYE ROMANTIC THEMES:
    if (chatTheme === 'romantic') return 'bg-gradient-to-br from-pink-100 to-rose-200 dark:from-pink-950/60 dark:to-rose-950/60';
    if (chatTheme === 'valentine') return 'bg-gradient-to-br from-red-50 to-pink-100 dark:from-red-950/50 dark:to-pink-900/50';
    
    return 'bg-[#F0F2F5] dark:bg-gray-900'; 
  };

  const visibleMessages = messages.filter(m => !m.is_deleted_for_me);
  const firstUnreadIndex = visibleMessages.findIndex(m => m.sender_id === receiverId && m.status !== 'read');
  const unreadCount = visibleMessages.filter(m => m.sender_id === receiverId && m.status !== 'read').length;

  return (
    <div 
      className={`w-full flex flex-col relative transition-colors overflow-hidden ${getThemeClasses()}`} 
      style={{ height: viewportHeight }}
      onClick={handleScreenClick}
    >
      
      {/* SELECTION HEADER (LONG PRESS OPTIONS) */}
      {selectedMessages.length > 0 ? (
        <div className="bg-chatverse text-white px-4 py-3 shadow-md flex justify-between items-center z-50 sticky top-0 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedMessages([])} className="hover:bg-white/20 p-1.5 rounded-full"><X className="w-6 h-6" /></button>
            <span className="font-bold text-lg">{selectedMessages.length}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Reply Button */}
            {selectedMessages.length === 1 && (
              <button onClick={() => { setReplyingTo(selectedMessages[0]); setSelectedMessages([]); setTimeout(() => document.getElementById('chat-input')?.focus(), 50); }} className="p-2 hover:bg-white/20 rounded-full"><Reply className="w-5 h-5" /></button>
            )}
            
            {/* Star Button */}
            <button onClick={() => {
              const ids = selectedMessages.map(m => m.id);
              setMessages(messages.map(msg => ids.includes(msg.id) ? { ...msg, is_starred: !msg.is_starred } : msg));
              setSelectedMessages([]);
            }} className="p-2 hover:bg-white/20 rounded-full"><Star className="w-5 h-5" /></button>
            
            {/* Copy Button */}
            <button onClick={() => { navigator.clipboard.writeText(selectedMessages.map(m => m.content).join('\n')); setSelectedMessages([]); }} className="p-2 hover:bg-white/20 rounded-full"><Copy className="w-5 h-5" /></button>
            
            {/* Delete For Me Button */}
            <button onClick={async () => {
              const msgId = selectedMessages[0].id;
              setMessages((prev) => prev.filter(msg => msg.id !== msgId));
              setSelectedMessages([]);
              try { await api.delete(`/messages/forme/${msgId}`); } catch(err){}
            }} className="p-2 hover:bg-white/20 rounded-full"><Trash2 className="w-5 h-5" /></button>
            
            {/* Delete For Everyone Button */}
            {selectedMessages.every(m => m.sender_id === currentUser.unique_id) && (
              <button onClick={() => {
                const ids = selectedMessages.filter(m => m.sender_id === currentUser.unique_id).map(m => m.id);
                setMessages(messages.map(msg => ids.includes(msg.id) ? { ...msg, content: "This message was deleted", is_deleted_for_everyone: true } : msg));
                if (socket) ids.forEach(id => socket.emit('delete_message_everyone', { messageId: id, receiverId }));
                setSelectedMessages([]);
              }} className="p-2 text-red-300 hover:text-red-100 hover:bg-white/20 rounded-full"><Trash2 className="w-5 h-5"/></button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 shadow-sm flex justify-between items-center z-50 sticky top-0 border-b border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"><ArrowLeft className="w-6 h-6" /></button>
            <div onClick={() => navigate(`/user/${receiverId}`, { state: { user: { unique_id: receiverId, username: friendName } } })} className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold uppercase shadow-sm">{friendName.charAt(0)}</div>
              <div className="flex flex-col">
                <h3 className="font-bold text-gray-900 dark:text-white text-[16.5px] leading-tight flex items-center truncate max-w-[140px] sm:max-w-[200px]">
                  {friendName}
                </h3>
                {isTyping ? (
                  <span className="text-[11px] text-chatverse dark:text-indigo-400 font-bold italic animate-pulse">typing...</span> 
                ) : isOnline ? (
                  <span className="text-[11px] text-[#4ADE80] font-bold">Online</span>
                ) : hideLastSeen ? (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">Last seen hidden</span>
                ) : (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    {lastSeenTime ? `Last seen ${formatLastSeen(lastSeenTime)}` : 'Last seen recently'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="relative">
            <button onClick={(e) => { 
                e.stopPropagation(); 
                setShowMenu(!showMenu); 
                setActiveReactId(null); 
                setShowEmojiPicker(false); 
              }} 
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[100]">
                <button onClick={() => { setShowMenu(false); setShowThemeModal(true); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-gray-700/50">
                  <Palette className="w-4 h-4 text-chatverse" /> Chat Theme
                </button>
                <button onClick={() => { setShowMenu(false); setShowSoundModal(true); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-gray-700/50">
                  <Music className="w-4 h-4 text-indigo-400" /> Chat Tone
                </button>
                
                <button onClick={() => { setMessages([]); setShowMenu(false); api.delete(`/chats/${receiverId}`); }} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold transition-colors">Clear Chat Now</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div 
        className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-2 relative"
        onScroll={handleScroll}
      >
        {messages.map((msg, index) => {

          const isMe = msg.sender_id === currentUser.unique_id;
          const hasReaction = !!msg.reaction;
          const isSelected = selectedMessages.some(m => m.id === msg.id);
          
          // Date Separator Logic
          const msgDate = new Date(msg.created_at || Date.now());
          const prevMsgDate = index > 0 ? new Date(messages[index - 1].created_at || Date.now()) : null;
          const showDateSeparator = !prevMsgDate || msgDate.toDateString() !== prevMsgDate.toDateString();

          // Grouping Logic
          const isPrevSameSender = !showDateSeparator && index > 0 && messages[index - 1].sender_id === msg.sender_id;
          const isNextSameSender = index < messages.length - 1 && messages[index + 1].sender_id === msg.sender_id && new Date(messages[index + 1].created_at || Date.now()).toDateString() === msgDate.toDateString();

          // Dynamic Bubble Styling
          let radiusClasses = 'rounded-2xl';
          if (isMe) {
            if (isPrevSameSender && isNextSameSender) radiusClasses = 'rounded-2xl rounded-tr-[4px] rounded-br-[4px]';
            else if (isPrevSameSender) radiusClasses = 'rounded-2xl rounded-tr-[4px]';
            else if (isNextSameSender) radiusClasses = 'rounded-2xl rounded-br-[4px]';
            else radiusClasses = 'rounded-2xl rounded-tr-[4px]';
          } else {
            if (isPrevSameSender && isNextSameSender) radiusClasses = 'rounded-2xl rounded-tl-[4px] rounded-bl-[4px]';
            else if (isPrevSameSender) radiusClasses = 'rounded-2xl rounded-tl-[4px]';
            else if (isNextSameSender) radiusClasses = 'rounded-2xl rounded-bl-[4px]';
            else radiusClasses = 'rounded-2xl rounded-tl-[4px]';
          }

          const marginClass = hasReaction ? 'mb-[24px]' : (isNextSameSender ? 'mb-[2px]' : 'mb-[12px]');

          return (
            <div key={msg.id || index} id={`msg-${msg.id}`} className={`w-full flex flex-col ${activeReactId === msg.id ? 'relative z-40' : 'relative z-0'}`}>
              
              {showDateSeparator && (
                 <div className="w-full flex justify-center my-4 relative z-0">
                    <span className="bg-gray-200/60 dark:bg-gray-800/60 backdrop-blur-sm text-gray-500 dark:text-gray-400 text-[11.5px] font-bold px-3.5 py-1 rounded-full shadow-sm z-10">
                      {msgDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                 </div>
              )}

              {/* Unread Divider */}
              {index === firstUnreadIndex && unreadCount > 0 && (
                <div className="w-full flex justify-center my-4 relative z-0">
                  <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-chatverse dark:text-indigo-400 text-[11px] font-black px-4 py-1.5 rounded-full z-10">
                    {unreadCount} UNREAD MESSAGE{unreadCount > 1 ? 'S' : ''}
                  </div>
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gray-300 dark:bg-gray-700/50 z-0"></div>
                </div>
              )}

              <div className={`flex w-full ${marginClass} group ${isMe ? 'justify-end' : 'justify-start'}`}>
                
                {isMe && !msg.is_deleted_for_everyone && (
                  <div className={`flex items-center gap-1 px-2 transition-opacity self-center ${swipingId === msg.id ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button onClick={(e) => { 
                        e.stopPropagation(); 
                        setActiveReactId(activeReactId === msg.id ? null : msg.id); 
                        setShowMenu(false); 
                        setShowEmojiPicker(false);
                      }} 
                      className="p-1.5 text-gray-500 hover:text-chatverse bg-white/50 dark:bg-black/20 rounded-full backdrop-blur-sm"
                    >
                      <Smile className="w-[18px] h-[18px]"/>
                    </button>
                  </div>
                )}

                <div className="relative max-w-[80%] flex flex-col">
                  
                  {swipingId === msg.id && (
                    <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center bg-black/10 dark:bg-white/10 rounded-full w-[28px] h-[28px] z-10"
                         style={{ left: '-6px', opacity: Math.min(swipeOffset / 40, 1), transform: `scale(${Math.min(swipeOffset / 40, 1)})` }}>
                      <Reply className="w-[14px] h-[14px] text-gray-700 dark:text-gray-200" />
                    </div>
                  )}

                  <div className="relative flex flex-col z-20"
                       style={{ transform: swipingId === msg.id ? `translateX(${swipeOffset}px)` : 'translateX(0px)', transition: swipingId === msg.id ? 'none' : 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)', touchAction: 'pan-y' }}>
                    
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
                      className={`message-bubble relative px-3 pt-2 pb-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.08)] cursor-pointer transition-all select-none ${
                        isSelected ? `bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-400 ${radiusClasses}` :
                        msg.is_deleted_for_everyone ? `bg-white/60 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 italic border border-gray-200 dark:border-gray-700 ${radiusClasses}` 
                        : isMe ? `bg-chatverse text-white ${radiusClasses}` 
                        : `bg-white dark:bg-gray-800 border border-gray-100/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-100 ${radiusClasses}`
                      }`}
                    >
                      
                      {/* Replied Message Styling */}
                      {msg.reply_content && !msg.is_deleted_for_everyone && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.reply_to_id); }}
                          className={`mb-1.5 px-3 py-2 rounded-lg text-[13px] border-l-[3px] cursor-pointer flex flex-col transition-all hover:opacity-80 active:opacity-60 ${isMe ? 'bg-black/10 border-white/70 text-indigo-50' : 'bg-gray-100 dark:bg-gray-700 border-chatverse text-gray-600 dark:text-gray-300'}`}
                        >
                          <span className="line-clamp-2 leading-relaxed font-medium">{msg.reply_content}</span>
                        </div>
                      )}
                      
                      <div className="relative text-[15.5px] leading-[1.4] break-words">
                        <span>{msg.content}</span>
                        {/* FIX: Improved invisible spacer width to completely avoid overlapping timestamps with text */}
                        {!msg.is_deleted_for_everyone && (
                          <span className={`inline-block h-[14px] ${isMe ? 'w-[85px]' : 'w-[60px]'}`}></span>
                        )}
                      </div>

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

                    {/* FIX: Perfected absolute coordinates so the reaction badge never hides the timestamp */}
                    {msg.reaction && !msg.is_deleted_for_everyone && (
                      <div className={`absolute -bottom-[14px] ${isMe ? 'right-2' : 'left-2'} bg-white dark:bg-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.15)] dark:border dark:border-gray-700 rounded-full px-[6px] py-[2px] text-[12px] z-30 select-none flex items-center justify-center`}>
                        {msg.reaction}
                      </div>
                    )}

                    {/* Single Line Inline WhatsApp-Style Reaction Tray */}
                    {activeReactId === msg.id && (
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className={`absolute z-[60] bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-gray-800 shadow-[0_4px_15px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-gray-700 px-3 py-2 flex flex-row items-center gap-3 rounded-full animate-slide-up whitespace-nowrap w-max`}
                      >
                        {reactionEmojis.map(emoji => (
                          <button 
                            key={emoji} 
                            onClick={() => handleInlineReaction(msg.id, emoji)} 
                            className={`text-[24px] leading-none hover:scale-125 transition-transform flex items-center justify-center ${msg.reaction === emoji ? 'scale-125 drop-shadow-md' : ''}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  
                  </div>
                </div>

                {!isMe && !msg.is_deleted_for_everyone && (
                  <div className={`flex items-center gap-1 px-2 transition-opacity self-center ${swipingId === msg.id ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button onClick={(e) => { 
                        e.stopPropagation(); 
                        setActiveReactId(activeReactId === msg.id ? null : msg.id); 
                        setShowMenu(false); 
                        setShowEmojiPicker(false);
                      }} 
                      className="p-1.5 text-gray-500 hover:text-chatverse bg-white/50 dark:bg-black/20 rounded-full backdrop-blur-sm"
                    >
                      <Smile className="w-[18px] h-[18px]"/>
                    </button>
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

      {showScrollButton && (
        <div className="absolute bottom-[80px] right-4 z-50 animate-slide-up">
          <button
            onClick={() => { scrollToBottom(); setNewMsgBadge(false); }}
            className="w-10 h-10 bg-white dark:bg-gray-800 text-chatverse shadow-[0_5px_15px_rgba(0,0,0,0.15)] rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-gray-100 dark:border-gray-700 relative"
          >
            {/* WHATSAPP STYLE RED DOT UNREAD BADGE */}
            {newMsgBadge && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full animate-bounce"></span>}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 flex flex-col border-t border-gray-100/60 dark:border-gray-700 shadow-md z-10 relative pb-[calc(env(safe-area-inset-bottom)+0px)]">
        
        {replyingTo && (
          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-l-4 border-chatverse flex justify-between items-center text-sm shadow-sm relative z-0">
             <div className="flex flex-col">
               <span className="text-chatverse dark:text-indigo-400 font-bold text-[13px]">Replying to {replyingTo.sender_id === currentUser.unique_id ? 'Yourself' : friendName}</span>
               <span className="text-gray-500 dark:text-gray-300 text-[12px] line-clamp-1">{replyingTo.content}</span>
             </div>
             <button onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white p-1"><X className="w-5 h-5"/></button>
          </div>
        )}

        {showEmojiPicker && (
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="absolute bottom-[70px] left-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl rounded-[20px] p-3 grid grid-cols-7 gap-1 z-50 w-80 h-72 overflow-y-auto no-scrollbar animate-slide-up"
          >
            {chatEmojis.map((e, index) => (
              <button 
                key={index} 
                onClick={() => setMessage(prev => prev + e)} 
                className="text-[26px] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center p-1.5 active:scale-95"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <div className="px-3 py-3 flex items-end gap-2 z-10 bg-white dark:bg-gray-800">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowEmojiPicker(!showEmojiPicker);
              setShowMenu(false);
              setActiveReactId(null); 
            }} 
            className={`p-2.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-indigo-50 dark:bg-indigo-900/30 text-chatverse' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <Smile className="w-[22px] h-[22px]" />
          </button>

          <textarea 
            id="chat-input"
            value={message} onChange={handleTyping} placeholder="Message..." 
            className="flex-1 max-h-28 overflow-y-auto no-scrollbar bg-gray-100/80 dark:bg-gray-700 dark:text-white rounded-[20px] px-4 py-2.5 text-[15.5px] focus:outline-none resize-none placeholder-gray-400 dark:placeholder-gray-400 shadow-sm" 
            rows="1" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
          />
          <button 
            onClick={() => {
              if (window.navigator?.vibrate) window.navigator.vibrate(15); 
              handleSend();
            }} 
            disabled={!message.trim()} 
            className={`p-3 rounded-full transition-all active:scale-90 ${message.trim() ? 'bg-chatverse text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>

      {showThemeModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4" onClick={() => setShowThemeModal(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-chatverse" /> Select Theme
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'default', name: 'Classic Blue', style: 'bg-gray-100 dark:bg-gray-700' },
                { id: 'sunset', name: 'Sunset Glow', style: 'bg-gradient-to-br from-rose-200 to-orange-200' },
                { id: 'emerald', name: 'Emerald', style: 'bg-gradient-to-br from-emerald-200 to-teal-200' },
                { id: 'midnight', name: 'Midnight', style: 'bg-gradient-to-br from-indigo-300 to-purple-300' },
                { id: 'romantic', name: 'Love Spark', style: 'bg-gradient-to-br from-pink-300 to-rose-400' },
                { id: 'valentine', name: 'Valentine', style: 'bg-gradient-to-br from-red-300 to-pink-300' }
              ].map(theme => (
                <button 
                  key={theme.id} 
                  onClick={() => applyTheme(theme.id)}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 ${chatTheme === theme.id ? 'ring-4 ring-chatverse ring-offset-2 dark:ring-offset-gray-800' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-full ${theme.style} shadow-inner`}></div>
                  <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{theme.name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowThemeModal(false)} className="mt-5 w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {showSoundModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4" onClick={() => setShowSoundModal(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-400" /> Notification Tone
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { id: 'default', name: 'Default Pop' },
                { id: 'minimal', name: 'Minimal Chime' },
                { id: 'retro', name: 'Retro Ping' }
              ].map(tone => {
                const currentTone = localStorage.getItem(`cv_sound_${receiverId}`) || 'default';
                return (
                  <button 
                    key={tone.id} 
                    onClick={() => testAndSetSound(tone.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl transition-colors ${currentTone === tone.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    <span className="font-bold text-[15px] text-gray-800 dark:text-gray-100">{tone.name}</span>
                    {currentTone === tone.id && <Check className="w-5 h-5 text-chatverse" />}
                  </button>
                )
              })}
            </div>
            <p className="text-center text-[12px] text-gray-400 mt-4 px-2">Tap a tone to hear a preview.</p>
            <button onClick={() => setShowSoundModal(false)} className="mt-3 w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl">Done</button>
          </div>
        </div>
      )}

    </div>
  );
}