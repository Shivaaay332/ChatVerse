const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { types } = require('pg'); 
const db = require('./db');
require('dotenv').config();

// ==========================================
// 100% PERFECT KOLKATA (IST) TIMEZONE FIX
// ==========================================
types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue + 'Z'); 
});

const app = express();
const server = http.createServer(app);

// Initialize DB (Auto-Fixer)
const initializeDatabase = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (unique_id TEXT PRIMARY KEY, username TEXT NOT NULL, email TEXT UNIQUE NOT NULL, mobile TEXT, age INTEGER, gender TEXT, password_hash TEXT NOT NULL, bio TEXT DEFAULT 'Available on ChatVerse ✨');
      CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS friend_requests (id SERIAL PRIMARY KEY, sender_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, receiver_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, receiver_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, content TEXT NOT NULL, status TEXT DEFAULT 'sent', reply_to_id INTEGER, reply_content TEXT, reaction TEXT, is_starred BOOLEAN DEFAULT FALSE, is_deleted_for_me BOOLEAN DEFAULT FALSE, is_deleted_for_everyone BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS post_likes (post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (post_id, user_id));
      CREATE TABLE IF NOT EXISTS post_comments (id SERIAL PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, comment TEXT NOT NULL, parent_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS blocked_users (blocker_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, blocked_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (blocker_id, blocked_id));
      CREATE TABLE IF NOT EXISTS post_comment_likes (comment_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (comment_id, user_id));
      CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, sender_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, type TEXT NOT NULL, reference_id INTEGER, content TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
    console.log("✅ Database Tables Auto-Synced!");
  } catch (err) { console.error("❌ DB Auto-Fix Error:", err); }
};
initializeDatabase();

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://chat-verse-mauve.vercel.app"], methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));
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
    const token = jwt.sign({ id: user.rows[0].unique_id }, process.env.JWT_SECRET || 'chatverse_super_secret_key_2026', { expiresIn: '7d' });
    res.status(200).json({ message: 'Login successful!', token, user: { unique_id: user.rows[0].unique_id, username: user.rows[0].username, bio: user.rows[0].bio } });
  } catch (err) { res.status(500).json({ error: 'Error during login' }); }
});

// --- USER APIs ---
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT unique_id, username, bio FROM users WHERE unique_id ILIKE $1 AND unique_id != $2 AND unique_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $2) AND unique_id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $2) LIMIT 10`, [`%${req.query.query}%`, req.user.id])).rows); } catch (err) { res.status(500).json({ error: 'Error searching' }); }
});
app.get('/api/users/me/stats', authenticateToken, async (req, res) => {
  try { res.status(200).json({ friendsCount: parseInt((await db.query(`SELECT COUNT(DISTINCT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END) FROM friend_requests WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [req.user.id])).rows[0].count) }); } catch (err) { res.status(500).json({ error: 'Error stats' }); }
});
app.put('/api/users/me/bio', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE users SET bio = $1 WHERE unique_id = $2`, [req.body.bio, req.user.id]); res.status(200).json({ message: 'Bio updated' }); } catch (err) { res.status(500).json({ error: 'Error updating bio' }); }
});

app.post('/api/users/block', authenticateToken, async (req, res) => {
  try {
    const { blocked_id } = req.body;
    await db.query(`INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.user.id, blocked_id]);
    await db.query(`DELETE FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`, [req.user.id, blocked_id]);
    res.status(200).json({ message: 'User blocked successfully' });
  } catch (err) { res.status(500).json({ error: 'Error blocking user' }); }
});
app.get('/api/users/blocked', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT b.blocked_id, u.username FROM blocked_users b JOIN users u ON b.blocked_id = u.unique_id WHERE b.blocker_id = $1`, [req.user.id])).rows); } catch (err) { res.status(500).json({ error: 'Error fetching blocked users' }); }
});
app.delete('/api/users/unblock/:id', authenticateToken, async (req, res) => {
  try { await db.query(`DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`, [req.user.id, req.params.id]); res.status(200).json({ message: 'User unblocked successfully' }); } catch (err) { res.status(500).json({ error: 'Error unblocking user' }); }
});

// --- NOTIFICATION APIs ---
app.get('/api/notifications/unread', authenticateToken, async (req, res) => {
  try {
    const fReqs = await db.query(`SELECT COUNT(*) FROM friend_requests WHERE receiver_id = $1 AND status = 'pending'`, [req.user.id]);
    const notifs = await db.query(`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`, [req.user.id]);
    res.status(200).json({ unread: parseInt(fReqs.rows[0].count) + parseInt(notifs.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Error counting notifications' }); }
});
app.put('/api/notifications/read', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, [req.user.id]); res.status(200).json({ message: 'Marked read' }); } catch (err) { res.status(500).json({ error: 'Error marking read' }); }
});
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const fReqs = await db.query(`SELECT fr.id as ref_id, u.unique_id, u.username, fr.created_at, 'friend_request' as type, FALSE as is_read, '' as content FROM friend_requests fr JOIN users u ON fr.sender_id = u.unique_id WHERE fr.receiver_id = $1 AND fr.status = 'pending'`, [req.user.id]);
    const notifs = await db.query(`SELECT n.id as notif_id, n.reference_id as ref_id, u.unique_id, u.username, n.created_at, n.type, n.is_read, n.content FROM notifications n JOIN users u ON n.sender_id = u.unique_id WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50`, [req.user.id]);
    res.status(200).json([...fReqs.rows, ...notifs.rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (err) { res.status(500).json({ error: 'Error fetching notifications' }); }
});
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try { await db.query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Notification deleted' }); } catch (err) { res.status(500).json({ error: 'Error deleting notification' }); }
});

// --- FRIENDS APIs ---
app.put('/api/friends/accept/:id', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE friend_requests SET status = 'accepted' WHERE id = $1 AND receiver_id = $2`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Accepted' }); } catch (err) { res.status(500).json({ error: 'Error accepting' }); }
});
app.delete('/api/friends/reject/:id', authenticateToken, async (req, res) => {
  try { await db.query(`DELETE FROM friend_requests WHERE id = $1 AND (receiver_id = $2 OR sender_id = $2)`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ error: 'Error rejecting' }); }
});
app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try { await db.query(`INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2)`, [req.user.id, req.body.receiver_id]); res.status(200).json({ message: 'Sent' }); } catch (err) { res.status(500).json({ error: 'Error sending' }); }
});
app.get('/api/friends/status/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT id, status, sender_id FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`, [req.user.id, req.params.otherUserId]);
    res.status(200).json(result.rows.length > 0 ? result.rows[0] : { status: 'none' });
  } catch (err) { res.status(500).json({ error: 'Error status' }); }
});

// NEW: GET ALL ACCEPTED FRIENDS FOR THE CHAT LIST MODAL
app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT u.unique_id, u.username, u.bio 
      FROM friend_requests fr 
      JOIN users u ON (u.unique_id = fr.sender_id OR u.unique_id = fr.receiver_id) 
      WHERE (fr.sender_id = $1 OR fr.receiver_id = $1) 
      AND fr.status = 'accepted' 
      AND u.unique_id != $1
      AND u.unique_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1) 
      AND u.unique_id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $1)
      ORDER BY u.username ASC
    `;
    const result = await db.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (err) { 
    res.status(500).json({ error: 'Error fetching friends list' }); 
  }
});

// --- POSTS & COMMENTS ---
app.post('/api/posts', authenticateToken, async (req, res) => {
  try { 
    const newPost = await db.query(`INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *`, [req.user.id, req.body.content]);
    const friends = await db.query(`SELECT sender_id, receiver_id FROM friend_requests WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [req.user.id]);
    const friendIds = friends.rows.map(f => f.sender_id === req.user.id ? f.receiver_id : f.sender_id);
    for(const fid of friendIds) { await db.query(`INSERT INTO notifications (user_id, sender_id, type, reference_id, content) VALUES ($1, $2, 'new_post', $3, $4)`, [fid, req.user.id, newPost.rows[0].id, req.body.content]); }
    res.status(201).json(newPost.rows[0]); 
  } catch (err) { res.status(500).json({ error: 'Error post' }); }
});

app.get('/api/posts', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT p.id, p.content, p.created_at, u.unique_id, u.username, (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked, (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count FROM posts p JOIN users u ON p.user_id = u.unique_id ORDER BY p.created_at DESC LIMIT 50`, [req.user.id])).rows); } catch (err) { res.status(500).json({ error: 'Error fetching' }); }
});
app.get('/api/posts/user/:id', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT p.id, p.content, p.created_at, u.unique_id, u.username, (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count, EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked, (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count FROM posts p JOIN users u ON p.user_id = u.unique_id WHERE p.user_id = $2 ORDER BY p.created_at DESC`, [req.user.id, req.params.id])).rows); } catch (err) { res.status(500).json({ error: 'Error user posts' }); }
});
app.put('/api/posts/:id', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE posts SET content = $1 WHERE id = $2 AND user_id = $3`, [req.body.content, req.params.id, req.user.id]); res.status(200).json({ message: 'Updated' }); } catch (err) { res.status(500).json({ error: 'Error editing post' }); }
});
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try { await db.query(`DELETE FROM posts WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ error: 'Error deleting' }); }
});

app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const check = await db.query('SELECT * FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (check.rows.length > 0) { 
      await db.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.id]); 
      await db.query(`DELETE FROM notifications WHERE sender_id = $1 AND type = 'post_like' AND reference_id = $2`, [req.user.id, req.params.id]);
      res.json({ liked: false }); 
    } else { 
      await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [req.params.id, req.user.id]); 
      const postData = await db.query('SELECT user_id, content FROM posts WHERE id=$1', [req.params.id]);
      if (postData.rows.length > 0 && postData.rows[0].user_id !== req.user.id) {
          await db.query(`INSERT INTO notifications (user_id, sender_id, type, reference_id, content) VALUES ($1, $2, 'post_like', $3, $4)`, [postData.rows[0].user_id, req.user.id, req.params.id, postData.rows[0].content]);
      }
      res.json({ liked: true }); 
    }
  } catch (err) { res.status(500).json({ error: 'Error like' }); }
});
app.get('/api/posts/:id/likes', authenticateToken, async (req, res) => {
  try { res.status(200).json((await db.query(`SELECT u.unique_id, u.username, u.bio FROM post_likes pl JOIN users u ON pl.user_id = u.unique_id WHERE pl.post_id = $1`, [req.params.id])).rows); } catch (err) { res.status(500).json({ error: 'Error fetching likes list' }); }
});

app.get('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  try { res.json((await db.query(`SELECT c.id, c.comment, c.parent_id, u.username, u.unique_id, c.created_at, (SELECT COUNT(*) FROM post_comment_likes WHERE comment_id = c.id) as like_count, EXISTS(SELECT 1 FROM post_comment_likes WHERE comment_id = c.id AND user_id = $2) as has_liked FROM post_comments c JOIN users u ON c.user_id = u.unique_id WHERE c.post_id = $1 ORDER BY c.created_at ASC`, [req.params.id, req.user.id])).rows); } catch (err) { res.status(500).json({ error: 'Error comments' }); }
});

app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  try { 
    const { comment, parent_id } = req.body;
    const result = await db.query(`INSERT INTO post_comments (post_id, user_id, comment, parent_id) VALUES ($1, $2, $3, $4) RETURNING id, comment, parent_id, created_at`, [req.params.id, req.user.id, comment, parent_id || null]);
    
    const postData = await db.query('SELECT user_id FROM posts WHERE id=$1', [req.params.id]);
    if (postData.rows[0].user_id !== req.user.id) {
       await db.query(`INSERT INTO notifications (user_id, sender_id, type, reference_id, content) VALUES ($1, $2, 'post_comment', $3, $4)`, [postData.rows[0].user_id, req.user.id, result.rows[0].id, comment]);
    }

    const mentions = comment.match(/@([a-zA-Z0-9_]+)/g);
    if (mentions) {
        for(const m of mentions) {
            const username = m.substring(1);
            const userCheck = await db.query('SELECT unique_id FROM users WHERE username ILIKE $1', [username]);
            if (userCheck.rows.length > 0 && userCheck.rows[0].unique_id !== req.user.id) {
               await db.query(`INSERT INTO notifications (user_id, sender_id, type, reference_id, content) VALUES ($1, $2, 'mention', $3, $4)`, [userCheck.rows[0].unique_id, req.user.id, result.rows[0].id, comment]);
            }
        }
    }
    res.json(result.rows[0]); 
  } catch (err) { res.status(500).json({ error: 'Error adding comment' }); }
});

app.post('/api/comments/:id/like', authenticateToken, async (req, res) => {
  try {
    const check = await db.query('SELECT * FROM post_comment_likes WHERE comment_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (check.rows.length > 0) { 
      await db.query('DELETE FROM post_comment_likes WHERE comment_id = $1 AND user_id = $2', [req.params.id, req.user.id]); 
      await db.query(`DELETE FROM notifications WHERE sender_id = $1 AND type = 'comment_like' AND reference_id = $2`, [req.user.id, req.params.id]);
      res.json({ liked: false }); 
    } else { 
      await db.query('INSERT INTO post_comment_likes (comment_id, user_id) VALUES ($1, $2)', [req.params.id, req.user.id]); 
      const commentData = await db.query('SELECT user_id, comment FROM post_comments WHERE id=$1', [req.params.id]);
      if (commentData.rows.length > 0 && commentData.rows[0].user_id !== req.user.id) {
         await db.query(`INSERT INTO notifications (user_id, sender_id, type, reference_id, content) VALUES ($1, $2, 'comment_like', $3, $4)`, [commentData.rows[0].user_id, req.user.id, req.params.id, commentData.rows[0].comment]);
      }
      res.json({ liked: true }); 
    }
  } catch (err) { res.status(500).json({ error: 'Error liking comment' }); }
});
app.put('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`UPDATE post_comments SET comment = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [req.body.comment, req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });
    res.status(200).json({ message: 'Comment updated' });
  } catch (err) { res.status(500).json({ error: 'Error editing comment' }); }
});
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const check = await db.query(`SELECT c.user_id as comment_author, p.user_id as post_author FROM post_comments c JOIN posts p ON c.post_id = p.id WHERE c.id = $1`, [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.id === check.rows[0].comment_author || req.user.id === check.rows[0].post_author) {
      await db.query(`DELETE FROM post_comments WHERE id = $1`, [req.params.id]);
      res.status(200).json({ message: 'Comment deleted' });
    } else { res.status(403).json({ error: 'Unauthorized' }); }
  } catch (err) { res.status(500).json({ error: 'Error deleting comment' }); }
});

// --- CHAT APIs ---
app.get('/api/chats/recent', authenticateToken, async (req, res) => {
  try { 
    const query = `
      WITH RankedMessages AS (
        SELECT 
          m.*, 
          CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_user_id,
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END 
            ORDER BY m.created_at DESC
          ) as rn
        FROM messages m
        WHERE (m.sender_id = $1 OR m.receiver_id = $1)
      )
      SELECT 
        u.unique_id, 
        u.username,
        rm.content AS last_message,
        rm.created_at AS last_message_time,
        rm.reaction,
        rm.sender_id,
        rm.is_deleted_for_everyone,
        rm.is_deleted_for_me,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.unique_id AND receiver_id = $1 AND status != 'read') AS unread_count
      FROM RankedMessages rm
      JOIN users u ON u.unique_id = rm.other_user_id
      WHERE rm.rn = 1 
      AND u.unique_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1) 
      AND u.unique_id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $1)
      ORDER BY rm.created_at DESC
    `;
    const result = await db.query(query, [req.user.id]);
    res.status(200).json(result.rows); 
  } catch (err) { res.status(500).json({ error: 'Error recent chats' }); }
});

app.get('/api/messages/unread/total', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND status != 'read'`, [req.user.id]);
    res.status(200).json({ unreadMessages: parseInt(result.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Error counting unread messages' }); }
});

app.get('/api/messages/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const messages = await db.query(`SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC`, [req.user.id, req.params.otherUserId]);
    await db.query(`UPDATE messages SET status = 'read' WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`, [req.params.otherUserId, req.user.id]);
    res.status(200).json(messages.rows);
  } catch (err) { res.status(500).json({ error: 'Error history' }); }
});
app.delete('/api/messages/forme/:id', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE messages SET is_deleted_for_me = TRUE WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)`, [req.params.id, req.user.id]); res.status(200).json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ error: 'Error delete msg' }); }
});
app.delete('/api/chats/:otherUserId', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE messages SET is_deleted_for_me = TRUE WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`, [req.user.id, req.params.otherUserId]); res.status(200).json({ message: 'Chat cleared' }); } catch (err) { res.status(500).json({ error: 'Error clear' }); }
});

// --- SOCKET.IO ---
const io = new Server(server, { cors: { origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://chat-verse-mauve.vercel.app"], methods: ["GET", "POST"] } });
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', (userId) => { if(userId) { onlineUsers.set(userId, socket.id); socket.userId = userId; io.emit('user_online', userId); } });
  socket.on('typing', ({ senderId, receiverId }) => { const s = onlineUsers.get(receiverId); if(s) io.to(s).emit('typing', senderId); });
  
  socket.on('send_message', async (data) => {
    try {
      const { tempId, senderId, receiverId, content, replyToId } = data;
      const blockCheck = await db.query(`SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`, [senderId, receiverId]);
      if (blockCheck.rows.length > 0) return; 

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