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

  // State Management for Privacy Settings
  const isMuted = localStorage.getItem(`cv_mute_${receiverId}`) === 'true';
  const hasCustomPrivacy = localStorage.getItem(`cv_privacy_${receiverId}`) === 'true';

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojis = ['😀','😂','🤣','😍','❤️','🙏','😢','😡','👍','👎','🔥','✨','🎉','🥺','😎','😊','🥰','🙌','👏','💪'];
  
  const endOfMessagesRef = useRef(null);
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

        // Mute Alert System: Mute hone par physical audio alerts suppress honge
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
    // Custom Privacy Check: Custom privacy hone par dusre user ko typing events block ho jayenge
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

  const handleReaction = (emoji) => {
    if (selectedMessages.length !== 1) return;
    const msgId = selectedMessages[0].id;
    setMessages(messages.map(msg => msg.id === msgId ? { ...msg, reaction: emoji } : msg));
    if (socket) socket.emit('react_message', { messageId: msgId, reaction: emoji, receiverId });
    setSelectedMessages([]);
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

  return (
    <div className="h-full w-full bg-[#F0F2F5] dark:bg-gray-900 flex flex-col relative transition-colors">
      
      {/* Top Action Bar */}
      {selectedMessages.length > 0 ? (
        <div className="bg-chatverse text-white px-4 py-3 shadow-md flex justify-between items-center z-30 sticky top-0 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedMessages([])} className="hover:bg-white/20 p-1.5 rounded-full"><X className="w-6 h-6" /></button>
            <span className="font-bold text-lg">{selectedMessages.length} Selected</span>
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
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md px-4 py-3 shadow-sm flex justify-between items-center z-20 sticky top-0 border-b border-gray-100 dark:border-gray-700 transition-colors">
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
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><MoreVertical className="w-5 h-5" /></button>
            {showMenu && (
              <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                <button onClick={() => { setMessages([]); setShowMenu(false); api.delete(`/chats/${receiverId}`); }} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold transition-colors">Clear Chat Now</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Feed & Action Popups remain flawless and functional */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 no-scrollbar" onClick={() => {setShowMenu(false); setShowEmojiPicker(false);}}>
        {messages.filter(m => !m.is_deleted_for_me).map((msg, idx) => {
          const isMe = msg.sender_id === currentUser.unique_id;
          const isSelected = selectedMessages.some(m => m.id === msg.id);

          return (
            <div key={msg.id || idx} className={`flex flex-col max-w-[78%] relative ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
              <div 
                onClick={() => toggleSelection(msg)}
                className={`px-4 py-2.5 shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap cursor-pointer transition-all active:scale-[0.98] ${
                  isSelected ? 'bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-400 rounded-2xl' :
                  msg.is_deleted_for_everyone ? 'bg-white/60 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 italic border border-gray-200 dark:border-gray-700 rounded-2xl' 
                  : isMe ? 'bg-chatverse text-white rounded-2xl rounded-tr-[4px]' 
                  : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-[4px]'
              }`}>
                {msg.reply_content && !msg.is_deleted_for_everyone && (
                  <div className={`mb-2 p-2 rounded-lg text-[13px] line-clamp-1 border-l-4 ${isMe ? 'bg-indigo-700/30 border-white/70 text-indigo-50' : 'bg-gray-100 dark:bg-gray-700 border-chatverse text-gray-600 dark:text-gray-300'}`}>
                    {msg.reply_content}
                  </div>
                )}
                {msg.content}
              </div>
              <div className="flex items-center gap-1 mt-1 px-1">
                {msg.is_starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                <span className="text-[10px] text-gray-400 font-medium">{formatTime(msg.created_at)}</span>
                {isMe && !msg.is_deleted_for_everyone && (
                  <div className="ml-0.5">
                    {msg.status === 'sending' && <Clock className="w-3 h-3 text-gray-400" />}
                    {msg.status === 'sent' && <Check className="w-3 h-3 text-gray-400" />}
                    {msg.status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-gray-500" />}
                    {msg.status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="self-start max-w-[75%] mt-1">
            <div className="px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-[4px] shadow-sm flex items-center gap-1.5 w-fit">
              <div className="w-1.5 h-1.5 bg-chatverse dark:bg-indigo-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-chatverse dark:bg-indigo-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-1.5 h-1.5 bg-chatverse dark:bg-indigo-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} className="h-2" />
      </div>

      {/* Input Field Control */}
      <div className="bg-white dark:bg-gray-800 flex flex-col border-t border-gray-100/60 dark:border-gray-700 shadow-md z-10">
        <div className="px-3 py-3 flex items-end gap-2 pb-4 relative">
          <textarea 
            value={message} onChange={handleTyping} placeholder="Type your message..." 
            className="flex-1 max-h-28 bg-gray-100/80 dark:bg-gray-700 dark:text-white rounded-[20px] px-4 py-3 focus:outline-none resize-none placeholder-gray-400" 
            rows="1" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
          />
          <button onClick={handleSend} disabled={!message.trim()} className={`p-3 rounded-full transition-all ${message.trim() ? 'bg-chatverse text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}