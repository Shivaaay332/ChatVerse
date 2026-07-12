const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { types } = require('pg'); // <-- IMPORTED FOR TIMEZONE FIX
const db = require('./db');
require('dotenv').config();

// ==========================================
// 100% PERFECT KOLKATA (IST) TIMEZONE FIX
// ==========================================
// Ye PostgreSQL ke UTC time ko hamesha correct IST me translate karega
types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue + 'Z'); 
});

const app = express();
const server = http.createServer(app);

// Initialize DB (Auto-Fixer)
const initializeDatabase = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS post_likes (post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (post_id, user_id));
      CREATE TABLE IF NOT EXISTS post_comments (id SERIAL PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, comment TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS blocked_users (blocker_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, blocked_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (blocker_id, blocked_id));
    `);
    console.log("✅ Database Tables Auto-Synced!");
  } catch (err) { console.error("❌ DB Auto-Fix Error:", err); }
};
initializeDatabase();

// Middlewares
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://chat-verse-mauve.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied!' });
  jwt.verify(token, process.env.JWT_SECRET || 'chatverse_super_secret_key_2026', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token!' });
    req.user = user;
    next();
  });
};

// --- AUTH APIs ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { unique_id, email, mobile, age, gender, password } = req.body;
    const userCheck = await db.query('SELECT * FROM users WHERE unique_id = $1 OR email = $2', [unique_id, email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: 'ID or Email exists!' });
    const password_hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const newUser = await db.query(`INSERT INTO users (unique_id, username, email, mobile, age, gender, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING unique_id, username`, [unique_id, unique_id, email, mobile, age, gender, password_hash]);
    res.status(201).json({ message: 'Account created!', user: newUser.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Error during signup' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE unique_id = $1 OR email = $1', [req.body.unique_id]);
    if (user.rows.length === 0) return res.status(400).json({ error: 'User not found!' });
    if (!await bcrypt.compare(req.body.password, user.rows[0].password_hash)) return res.status(400).json({ error: 'Incorrect password!' });
    const token = jwt.sign({ id: user.rows[0].unique_id }, process.env.JWT_SECRET || 'key', { expiresIn: '7d' });
    res.status(200).json({ message: 'Login successful!', token, user: { unique_id: user.rows[0].unique_id, username: user.rows[0].username, bio: user.rows[0].bio } });
  } catch (err) { res.status(500).json({ error: 'Error during login' }); }
});

// --- USER & FRIEND APIs ---
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT unique_id, username, bio FROM users WHERE unique_id ILIKE $1 AND unique_id != $2 LIMIT 10`, [`%${req.query.query}%`, req.user.id])).rows); } 
  catch (err) { res.status(500).json({ error: 'Error searching' }); }
});

app.get('/api/users/me/stats', authenticateToken, async (req, res) => {
  try { res.status(200).json({ friendsCount: parseInt((await db.query(`SELECT COUNT(DISTINCT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END) FROM friend_requests WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [req.user.id])).rows[0].count) }); } 
  catch (err) { res.status(500).json({ error: 'Error stats' }); }
});

app.put('/api/users/me/bio', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE users SET bio = $1 WHERE unique_id = $2`, [req.body.bio, req.user.id]); res.status(200).json({ message: 'Bio updated' }); } 
  catch (err) { res.status(500).json({ error: 'Error updating bio' }); }
});

app.get('/api/friends/requests', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT fr.id, u.unique_id, u.username, fr.created_at FROM friend_requests fr JOIN users u ON fr.sender_id = u.unique_id WHERE fr.receiver_id = $1 AND fr.status = 'pending'`, [req.user.id])).rows); } 
  catch (err) { res.status(500).json({ error: 'Error requests' }); }
});

app.put('/api/friends/accept/:id', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE friend_requests SET status = 'accepted' WHERE id = $1 AND receiver_id = $2`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Accepted' }); } 
  catch (err) { res.status(500).json({ error: 'Error accepting' }); }
});

app.delete('/api/friends/reject/:id', authenticateToken, async (req, res) => {
  try { await db.query(`DELETE FROM friend_requests WHERE id = $1 AND receiver_id = $2`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Deleted' }); } 
  catch (err) { res.status(500).json({ error: 'Error rejecting' }); }
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try { await db.query(`INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2)`, [req.user.id, req.body.receiver_id]); res.status(200).json({ message: 'Sent' }); } 
  catch (err) { res.status(500).json({ error: 'Error sending' }); }
});

app.get('/api/friends/status/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT id, status, sender_id FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`, [req.user.id, req.params.otherUserId]);
    res.status(200).json(result.rows.length > 0 ? result.rows[0] : { status: 'none' });
  } catch (err) { res.status(500).json({ error: 'Error status' }); }
});

// --- POSTS & LIKES & COMMENTS APIs ---
app.post('/api/posts', authenticateToken, async (req, res) => {
  try { res.status(201).json((await db.query(`INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *`, [req.user.id, req.body.content])).rows[0]); } 
  catch (err) { res.status(500).json({ error: 'Error post' }); }
});

app.get('/api/posts', authenticateToken, async (req, res) => {
  try {
    const posts = await db.query(`SELECT p.id, p.content, p.created_at, u.unique_id, u.username, (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked, (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count FROM posts p JOIN users u ON p.user_id = u.unique_id ORDER BY p.created_at DESC LIMIT 50`, [req.user.id]);
    res.status(200).json(posts.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching' }); }
});

app.get('/api/posts/user/:id', authenticateToken, async (req, res) => {
  try {
    const posts = await db.query(`SELECT p.id, p.content, p.created_at, u.unique_id, u.username, (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked, (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count FROM posts p JOIN users u ON p.user_id = u.unique_id WHERE p.user_id = $2 ORDER BY p.created_at DESC`, [req.user.id, req.params.id]);
    res.status(200).json(posts.rows);
  } catch (err) { res.status(500).json({ error: 'Error user posts' }); }
});

// ** NEW API: EDIT POST **
app.put('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    await db.query(`UPDATE posts SET content = $1 WHERE id = $2 AND user_id = $3`, [req.body.content, req.params.id, req.user.id]);
    res.status(200).json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: 'Error editing post' }); }
});

app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try { await db.query(`DELETE FROM posts WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Deleted' }); } 
  catch (err) { res.status(500).json({ error: 'Error deleting' }); }
});

app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const check = await db.query('SELECT * FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (check.rows.length > 0) { await db.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.id]); res.json({ liked: false }); } 
    else { await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [req.params.id, req.user.id]); res.json({ liked: true }); }
  } catch (err) { res.status(500).json({ error: 'Error like' }); }
});

app.get('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  try { res.json((await db.query(`SELECT c.id, c.comment, u.username FROM post_comments c JOIN users u ON c.user_id = u.unique_id WHERE c.post_id = $1 ORDER BY c.created_at ASC`, [req.params.id])).rows); } 
  catch (err) { res.status(500).json({ error: 'Error comments' }); }
});

app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  try { res.json((await db.query(`INSERT INTO post_comments (post_id, user_id, comment) VALUES ($1, $2, $3) RETURNING id, comment`, [req.params.id, req.user.id, req.body.comment])).rows[0]); } 
  catch (err) { res.status(500).json({ error: 'Error adding comment' }); }
});

// --- CHAT APIs ---
app.get('/api/chats/recent', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT DISTINCT u.unique_id, u.username FROM users u JOIN messages m ON (u.unique_id = m.sender_id OR u.unique_id = m.receiver_id) WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND u.unique_id != $1`, [req.user.id])).rows); } 
  catch (err) { res.status(500).json({ error: 'Error recent chats' }); }
});

app.get('/api/messages/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const messages = await db.query(`SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC`, [req.user.id, req.params.otherUserId]);
    await db.query(`UPDATE messages SET status = 'read' WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`, [req.params.otherUserId, req.user.id]);
    res.status(200).json(messages.rows);
  } catch (err) { res.status(500).json({ error: 'Error history' }); }
});

app.delete('/api/messages/forme/:id', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE messages SET is_deleted_for_me = TRUE WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Deleted' }); } 
  catch (err) { res.status(500).json({ error: 'Error delete msg' }); }
});

app.delete('/api/chats/:otherUserId', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE messages SET is_deleted_for_me = TRUE WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`, [req.user.id, req.params.otherUserId]); res.status(200).json({ message: 'Chat cleared' }); } 
  catch (err) { res.status(500).json({ error: 'Error clear' }); }
});

// --- SOCKET.IO ---
const io = new Server(server, { 
  cors: { 
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://chat-verse-mauve.vercel.app"], 
    methods: ["GET", "POST"] 
  }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', (userId) => { if(userId) { onlineUsers.set(userId, socket.id); socket.userId = userId; io.emit('user_online', userId); } });
  socket.on('typing', ({ senderId, receiverId }) => { const s = onlineUsers.get(receiverId); if(s) io.to(s).emit('typing', senderId); });
  
  socket.on('send_message', async (data) => {
    try {
      const { tempId, senderId, receiverId, content, replyToId } = data;
      const initialStatus = onlineUsers.get(receiverId) ? 'delivered' : 'sent';
      let replyContent = null;
      if (replyToId) {
        const pMsg = await db.query(`SELECT content FROM messages WHERE id = $1`, [replyToId]);
        if (pMsg.rows.length > 0) replyContent = pMsg.rows[0].content;
      }
      const savedMsg = await db.query(`INSERT INTO messages (sender_id, receiver_id, content, status, reply_to_id, reply_content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [senderId, receiverId, content, initialStatus, replyToId, replyContent]);
      if (onlineUsers.get(receiverId)) io.to(onlineUsers.get(receiverId)).emit('receive_message', savedMsg.rows[0]);
      socket.emit('message_status', { tempId, realId: savedMsg.rows[0].id, status: initialStatus });
    } catch (err) { console.error(err); }
  });

  socket.on('react_message', async ({ messageId, reaction, receiverId }) => {
    try { await db.query(`UPDATE messages SET reaction = $1 WHERE id = $2`, [reaction, messageId]); if(onlineUsers.get(receiverId)) io.to(onlineUsers.get(receiverId)).emit('message_updated', { id: messageId, reaction }); } catch (err) {}
  });

  socket.on('delete_message_everyone', async ({ messageId, receiverId }) => {
    try { await db.query(`UPDATE messages SET is_deleted_for_everyone = TRUE, content = 'This message was deleted' WHERE id = $1`, [messageId]); if(onlineUsers.get(receiverId)) io.to(onlineUsers.get(receiverId)).emit('message_updated', { id: messageId, is_deleted_for_everyone: true, content: 'This message was deleted' }); } catch (err) {}
  });

  socket.on('mark_as_read', async ({ messageId, senderId }) => {
    try { await db.query(`UPDATE messages SET status = 'read' WHERE id = $1`, [messageId]); if(onlineUsers.get(senderId)) io.to(onlineUsers.get(senderId)).emit('message_updated', { id: messageId, status: 'read' }); } catch (err) {}
  });

  socket.on('disconnect', async () => { if (socket.userId) { onlineUsers.delete(socket.userId); io.emit('user_offline', { userId: socket.userId }); } });
});

server.listen(process.env.PORT || 5000, () => console.log(`🚀 ChatVerse Backend Running!`));