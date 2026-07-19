const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { types } = require('pg'); 
const db = require('./db');
const webpush = require('web-push'); // <-- NAYA PUSH PACKAGE ADD KIYA HAI
const nodemailer = require('nodemailer'); // ✅ NAYA: Email bhejne ke liye
require('dotenv').config();

// ✅ NAYA: Nodemailer Setup (Ise apni .env file me EMAIL_USER aur EMAIL_PASS daal kar use karna, Password normal nahi "App Password" hona chahiye Gmail se)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your_email@gmail.com', 
    pass: process.env.EMAIL_PASS || 'your_app_password' 
  }
});

// FIX: Secure JWT Fallback Logic
const JWT_SECRET_KEY = process.env.JWT_SECRET;
if (!JWT_SECRET_KEY) {
  console.warn("⚠️ CRITICAL WARNING: JWT_SECRET is missing in .env! Using insecure fallback. DO NOT USE IN PRODUCTION.");
}
const ACTIVE_JWT_SECRET = JWT_SECRET_KEY || 'chatverse_super_secret_key_2026';

// ==========================================
// VAPID KEYS FOR BACKGROUND PUSH NOTIFICATIONS
// ==========================================
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeZ1TANY_lr2vrQQlQriTAjZ-dLZG2F2gGkQGzS1tW32MvM9gNf0';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'Z52G4Xq1pWn_t2E1mS_R1U0x84q8j-0eP23C42-E6_M';

webpush.setVapidDetails(
  'mailto:support@chatverse.com',
  publicVapidKey,
  privateVapidKey
);

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
      CREATE TABLE IF NOT EXISTS users (unique_id TEXT PRIMARY KEY, username TEXT NOT NULL, email TEXT UNIQUE NOT NULL, mobile TEXT, age INTEGER, gender TEXT, password_hash TEXT NOT NULL, bio TEXT DEFAULT 'Available on ChatVerse ✨', is_verified BOOLEAN DEFAULT FALSE);
      CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS friend_requests (id SERIAL PRIMARY KEY, sender_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, receiver_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, receiver_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, content TEXT NOT NULL, status TEXT DEFAULT 'sent', reply_to_id INTEGER, reply_content TEXT, reaction TEXT, is_starred BOOLEAN DEFAULT FALSE, is_deleted_for_me BOOLEAN DEFAULT FALSE, is_deleted_for_everyone BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS post_likes (post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (post_id, user_id));
      CREATE TABLE IF NOT EXISTS post_comments (id SERIAL PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, comment TEXT NOT NULL, parent_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS blocked_users (blocker_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, blocked_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (blocker_id, blocked_id));
      CREATE TABLE IF NOT EXISTS post_comment_likes (comment_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, PRIMARY KEY (comment_id, user_id));
      CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, sender_id TEXT REFERENCES users(unique_id) ON DELETE CASCADE, type TEXT NOT NULL, reference_id INTEGER, content TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);

    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;`);
    await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by TEXT[] DEFAULT '{}';`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
    
    // MISSING PRIVACY COLUMNS FIX
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_last_seen BOOLEAN DEFAULT FALSE;`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_online_status BOOLEAN DEFAULT FALSE;`);
    
    // FIX: NAYA COLUMN BACKGROUND PUSH KE LIYE
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSON;`);
    
    // ✅ NAYA: Forgot Password OTP Columns
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp TEXT;`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMP;`);
    
    console.log("✅ Database Tables Auto-Synced! Verified & Privacy Columns Active. Web Push Ready!");
  } catch (err) { console.error("❌ DB Auto-Fix Error:", err); }
};
initializeDatabase();

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://chat-verse-mauve.vercel.app"], methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));
app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied!' });
  jwt.verify(token, ACTIVE_JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token!' });
    req.user = user;
    next();
  });
};

// --- SUBSCRIPTION API (New for Web Push) ---
app.post('/api/notifications/subscribe', authenticateToken, async (req, res) => {
  try {
    const subscription = req.body;
    await db.query(`UPDATE users SET push_subscription = $1 WHERE unique_id = $2`, [subscription, req.user.id]);
    res.status(201).json({ message: 'Push Subscribed' });
  } catch (err) { res.status(500).json({ error: 'Failed to subscribe' }); }
});

// --- AUTH APIs ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { unique_id, email, mobile, age, gender, password } = req.body;
    const userCheck = await db.query('SELECT * FROM users WHERE unique_id = $1 OR email = $2', [unique_id, email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: 'ID or Email exists!' });
    const password_hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const newUser = await db.query(`INSERT INTO users (unique_id, username, email, mobile, age, gender, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING unique_id, username, is_verified`, [unique_id, unique_id, email, mobile, age, gender, password_hash]);
    res.status(201).json({ message: 'Account created!', user: newUser.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Error during signup' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    // ✅ NAYA CHANGE: Frontend se email aaye ya unique_id, dono ko accurately catch karega
    const loginIdentifier = req.body.email || req.body.unique_id;
    const user = await db.query('SELECT * FROM users WHERE unique_id = $1 OR email = $1', [loginIdentifier]);
    
    if (user.rows.length === 0) return res.status(400).json({ error: 'User not found!' });
    if (!await bcrypt.compare(req.body.password, user.rows[0].password_hash)) return res.status(400).json({ error: 'Incorrect password!' });
    const token = jwt.sign({ id: user.rows[0].unique_id }, ACTIVE_JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ message: 'Login successful!', token, user: { unique_id: user.rows[0].unique_id, username: user.rows[0].username, bio: user.rows[0].bio, is_verified: user.rows[0].is_verified } });
  } catch (err) { res.status(500).json({ error: 'Error during login' }); }
});

// ✅ NAYA CODE: Forgot Password OTP Generation
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Email not registered!' });

    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
    const expiry = new Date(Date.now() + 10 * 60000); // 10 minutes expiry

    await db.query(`UPDATE users SET reset_otp = $1, reset_otp_expiry = $2 WHERE email = $3`, [otp, expiry, email]);

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your_email@gmail.com',
      to: email,
      subject: 'ChatVerse - Password Reset OTP',
      html: `<h2>Your OTP is: <b style="color: #4f46e5;">${otp}</b></h2><p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>`
    });

    res.status(200).json({ message: 'OTP sent successfully!' });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP.' }); 
  }
});

// ✅ NAYA CODE: Verify OTP & Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await db.query('SELECT reset_otp, reset_otp_expiry FROM users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found!' });
    if (user.rows[0].reset_otp !== otp) return res.status(400).json({ error: 'Invalid OTP!' });
    if (new Date() > new Date(user.rows[0].reset_otp_expiry)) return res.status(400).json({ error: 'OTP has expired!' });

    const password_hash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await db.query(`UPDATE users SET password_hash = $1, reset_otp = NULL, reset_otp_expiry = NULL WHERE email = $2`, [password_hash, email]);

    res.status(200).json({ message: 'Password reset successful!' });
  } catch (err) { res.status(500).json({ error: 'Failed to reset password.' }); }
});

// --- USER APIs ---
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try { 
    // ✅ NAYA CHANGE: Ab unique_id ke sath-sath username (Full Name) column mein bhi search karega
    const searchQuery = `
      SELECT unique_id, username, bio, is_verified 
      FROM users 
      WHERE (unique_id ILIKE $1 OR username ILIKE $1) 
      AND unique_id != $2 
      AND unique_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $2) 
      AND unique_id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $2) 
      LIMIT 15
    `;
    const result = await db.query(searchQuery, [`%${req.query.query}%`, req.user.id]);
    res.status(200).json(result.rows); 
  } catch (err) { 
    res.status(500).json({ error: 'Error searching' }); 
  }
});

app.get('/api/users/me/stats', authenticateToken, async (req, res) => {
  try { res.status(200).json({ friendsCount: parseInt((await db.query(`SELECT COUNT(DISTINCT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END) FROM friend_requests WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [req.user.id])).rows[0].count) }); } catch (err) { res.status(500).json({ error: 'Error stats' }); }
});

app.put('/api/users/me/bio', authenticateToken, async (req, res) => {
  try { await db.query(`UPDATE users SET bio = $1 WHERE unique_id = $2`, [req.body.bio, req.user.id]); res.status(200).json({ message: 'Bio updated' }); } catch (err) { res.status(500).json({ error: 'Error updating bio' }); }
});

app.put('/api/users/me/verify', authenticateToken, async (req, res) => {
  try {
    await db.query(`UPDATE users SET is_verified = TRUE WHERE unique_id = $1`, [req.user.id]);
    res.status(200).json({ message: 'Account verified successfully!' });
  } catch (err) { res.status(500).json({ error: 'Error verifying account' }); }
});

app.put('/api/users/me/privacy', authenticateToken, async (req, res) => {
  try {
    if (req.body.hideLastSeen !== undefined) {
      await db.query(`UPDATE users SET hide_last_seen = $1 WHERE unique_id = $2`, [req.body.hideLastSeen, req.user.id]);
    }
    if (req.body.hideOnlineStatus !== undefined) {
      await db.query(`UPDATE users SET hide_online_status = $1 WHERE unique_id = $2`, [req.body.hideOnlineStatus, req.user.id]);
      
      // Instantly push offline status globally if hidden
      if (req.body.hideOnlineStatus === true) {
         io.emit('user_offline', { userId: req.user.id, lastSeen: new Date().toISOString() });
      } else {
         if (onlineUsers.has(req.user.id)) {
            io.emit('user_online', req.user.id);
         }
      }
    }
    res.status(200).json({ message: 'Privacy updated' });
  } catch (err) { res.status(500).json({ error: 'Error updating privacy' }); }
});

app.delete('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required to delete account' });
    const user = await db.query('SELECT password_hash FROM users WHERE unique_id = $1', [req.user.id]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const isValid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isValid) return res.status(400).json({ error: 'Incorrect password!' });
    await db.query('DELETE FROM users WHERE unique_id = $1', [req.user.id]);
    res.status(200).json({ message: 'Account permanently deleted' });
  } catch (err) { res.status(500).json({ error: 'Error deleting account' }); }
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
  try { res.status(200).json((await db.query(`SELECT b.blocked_id, u.username, u.is_verified FROM blocked_users b JOIN users u ON b.blocked_id = u.unique_id WHERE b.blocker_id = $1`, [req.user.id])).rows); } catch (err) { res.status(500).json({ error: 'Error fetching blocked users' }); }
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
    const fReqs = await db.query(`SELECT fr.id as ref_id, u.unique_id, u.username, u.is_verified, fr.created_at, 'friend_request' as type, FALSE as is_read, '' as content FROM friend_requests fr JOIN users u ON fr.sender_id = u.unique_id WHERE fr.receiver_id = $1 AND fr.status = 'pending'`, [req.user.id]);
    const notifs = await db.query(`SELECT n.id as notif_id, n.reference_id as ref_id, u.unique_id, u.username, u.is_verified, n.created_at, n.type, n.is_read, n.content FROM notifications n JOIN users u ON n.sender_id = u.unique_id WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50`, [req.user.id]);
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

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT u.unique_id, u.username, u.bio, u.is_verified 
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
  } catch (err) { res.status(500).json({ error: 'Error fetching friends' }); }
});

// --- POSTS & COMMENTS ---
app.post('/api/posts', authenticateToken, async (req, res) => {
  try { 
    const newPost = await db.query(`INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *`, [req.user.id, req.body.content]);
    const friends = await db.query(`SELECT sender_id, receiver_id FROM friend_requests WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [req.user.id]);
    const friendIds = friends.rows.map(f => f.sender_id === req.user.id ? f.receiver_id : f.sender_id);
    
    // FIX: Parallel Database Execution to avoid DB Bottleneck
    await Promise.all(friendIds.map(fid => 
      db.query(`INSERT INTO notifications (user_id, sender_id, type, reference_id, content) VALUES ($1, $2, 'new_post', $3, $4)`, [fid, req.user.id, newPost.rows[0].id, req.body.content])
    ));
    
    res.status(201).json(newPost.rows[0]); 
  } catch (err) { console.error("Post Error:", err); res.status(500).json({ error: 'Error post' }); }
});

app.get('/api/posts', authenticateToken, async (req, res) => {
  try { 
    const query = `
      SELECT p.id, p.content, p.created_at, u.unique_id, u.username, u.is_verified, 
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count, 
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked, 
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count 
      FROM posts p 
      JOIN users u ON p.user_id = u.unique_id 
      WHERE p.user_id = $1 OR p.user_id IN (
        SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
        FROM friend_requests
        WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'
      )
      ORDER BY p.created_at DESC LIMIT 50
    `;
    res.status(200).json((await db.query(query, [req.user.id])).rows); 
  } catch (err) { res.status(500).json({ error: 'Error fetching' }); }
});

app.get('/api/posts/user/:id', authenticateToken, async (req, res) => {
  try { 
    const query = `
      SELECT p.id, p.content, p.created_at, u.unique_id, u.username, u.is_verified, 
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count, 
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked, 
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count 
      FROM posts p 
      JOIN users u ON p.user_id = u.unique_id 
      WHERE p.user_id = $2 AND (
        $2 = $1 OR EXISTS (
          SELECT 1 FROM friend_requests
          WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
          AND status = 'accepted'
        )
      )
      ORDER BY p.created_at DESC
    `;
    res.status(200).json((await db.query(query, [req.user.id, req.params.id])).rows); 
  } catch (err) { res.status(500).json({ error: 'Error user posts' }); }
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
  try { res.status(200).json((await db.query(`SELECT u.unique_id, u.username, u.bio, u.is_verified FROM post_likes pl JOIN users u ON pl.user_id = u.unique_id WHERE pl.post_id = $1`, [req.params.id])).rows); } catch (err) { res.status(500).json({ error: 'Error fetching likes' }); }
});

app.get('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  try { res.json((await db.query(`SELECT c.id, c.comment, c.parent_id, u.username, u.unique_id, u.is_verified, c.created_at, (SELECT COUNT(*) FROM post_comment_likes WHERE comment_id = c.id) as like_count, EXISTS(SELECT 1 FROM post_comment_likes WHERE comment_id = c.id AND user_id = $2) as has_liked FROM post_comments c JOIN users u ON c.user_id = u.unique_id WHERE c.post_id = $1 ORDER BY c.created_at ASC`, [req.params.id, req.user.id])).rows); } catch (err) { res.status(500).json({ error: 'Error comments' }); }
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
        AND NOT ($1 = ANY(m.deleted_by))
        AND m.is_deleted_for_me = FALSE
      )
      SELECT 
        u.unique_id, 
        u.username,
        u.is_verified,
        rm.content AS last_message,
        rm.created_at AS last_message_time,
        rm.reaction,
        rm.sender_id,
        rm.is_deleted_for_everyone,
        rm.is_deleted_for_me,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.unique_id AND receiver_id = $1 AND status != 'read' AND is_deleted_for_me = FALSE) AS unread_count
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
    const result = await db.query(`SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND status != 'read' AND is_deleted_for_me = FALSE`, [req.user.id]);
    res.status(200).json({ unreadMessages: parseInt(result.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Error counting unread messages' }); }
});

app.get('/api/messages/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const messages = await db.query(`SELECT * FROM messages WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)) AND NOT ($1 = ANY(deleted_by)) ORDER BY created_at ASC`, [req.user.id, req.params.otherUserId]);
    await db.query(`UPDATE messages SET status = 'read' WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`, [req.params.otherUserId, req.user.id]);
    res.status(200).json(messages.rows);
  } catch (err) { res.status(500).json({ error: 'Error history' }); }
});

app.delete('/api/messages/forme/:id', authenticateToken, async (req, res) => {
  try { 
    await db.query(`UPDATE messages SET deleted_by = array_append(deleted_by, $1) WHERE id = $2 AND (sender_id = $1 OR receiver_id = $1)`, [req.user.id, req.params.id]); 
    res.status(200).json({ message: 'Message deleted for you' }); 
  } catch (err) { res.status(500).json({ error: 'Error delete msg' }); }
});

app.delete('/api/chats/:otherUserId', authenticateToken, async (req, res) => {
  try { 
    await db.query(`UPDATE messages SET deleted_by = array_append(deleted_by, $1) WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)) AND NOT ($1 = ANY(deleted_by))`, [req.user.id, req.params.otherUserId]); 
    res.status(200).json({ message: 'Chat permanently cleared for you' }); 
  } catch (err) { res.status(500).json({ error: 'Error clear' }); }
});

// --- SOCKET.IO ---
const io = new Server(server, { cors: { origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://chat-verse-mauve.vercel.app"], methods: ["GET", "POST"] } });
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', async (userId) => {
    if (userId) {
      // FIX: Native Socket Rooms se Multiple-Devices support karna
      socket.join(userId);
      const currentCount = onlineUsers.get(userId) || 0;
      onlineUsers.set(userId, currentCount + 1);
      socket.userId = userId;

      try {
        const u = await db.query('SELECT hide_online_status FROM users WHERE unique_id = $1', [userId]);
        // Sirf tabhi online bhejo jab pehla device connect ho
        if (!u.rows[0]?.hide_online_status && currentCount === 0) {
           io.emit('user_online', userId);
        }

        const undelivered = await db.query(
          `UPDATE messages SET status = 'delivered' WHERE receiver_id = $1 AND status = 'sent' RETURNING id, sender_id`,
          [userId]
        );

        undelivered.rows.forEach(msg => {
          // Native Room emission (will reach all active devices of sender)
          io.to(msg.sender_id).emit('message_updated', { id: msg.id, status: 'delivered' });
        });
      } catch (err) { console.error("Error updating delivery status on join:", err); }
    }
  });

  socket.on('typing', ({ senderId, receiverId }) => { 
    // FIX: Emit directly to room instead of single socket id
    io.to(receiverId).emit('typing', senderId); 
  });
  
  socket.on('sync_messages', async (userId) => {
    try {
      const query = `
        WITH RankedMessages AS (
          SELECT 
            m.*, 
            CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_user_id,
            ROW_NUMBER() OVER (PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END ORDER BY m.created_at DESC) as rn
          FROM messages m
          WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND NOT ($1 = ANY(m.deleted_by)) AND m.is_deleted_for_me = FALSE
        )
        SELECT 
          u.unique_id, u.username, u.is_verified, rm.content AS last_message, rm.created_at AS last_message_time,
          rm.reaction, rm.sender_id, rm.is_deleted_for_everyone, rm.is_deleted_for_me,
          (SELECT COUNT(*) FROM messages WHERE sender_id = u.unique_id AND receiver_id = $1 AND status != 'read' AND is_deleted_for_me = FALSE) AS unread_count
        FROM RankedMessages rm
        JOIN users u ON u.unique_id = rm.other_user_id
        WHERE rm.rn = 1 AND u.unique_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1) AND u.unique_id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $1)
        ORDER BY rm.created_at DESC
      `;
      const result = await db.query(query, [userId]);
      socket.emit('sync_complete', result.rows);
    } catch (err) { console.error("Error syncing messages:", err); }
  });

  socket.on('change_chat_theme', ({ themeId, senderId, receiverId }) => {
    io.to(receiverId).emit('theme_updated', { themeId });
  });

  socket.on('send_message', async (data) => {
    try {
      const { tempId, senderId, receiverId, content, replyToId } = data;
      const blockCheck = await db.query(`SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`, [senderId, receiverId]);
      if (blockCheck.rows.length > 0) return; 

      let initialStatus = 'sent';
      let replyContent = null;
      if (replyToId) {
        const pMsg = await db.query(`SELECT content FROM messages WHERE id = $1`, [replyToId]);
        if (pMsg.rows.length > 0) replyContent = pMsg.rows[0].content;
      }
      
      const savedMsg = await db.query(`INSERT INTO messages (sender_id, receiver_id, content, status, reply_to_id, reply_content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [senderId, receiverId, content, initialStatus, replyToId, replyContent]);
      
      let isReceiverActive = false;
      
      // FIX: Send via Room (Checks if receiver has any active device connected)
      if (onlineUsers.has(receiverId) && onlineUsers.get(receiverId) > 0) {
        io.to(receiverId).emit('receive_message', savedMsg.rows[0]);
        isReceiverActive = true;
      }

      // FIX: Only send Background Push Notification if User is NOT Active in app
      if (!isReceiverActive) {
        try {
          const userRes = await db.query('SELECT push_subscription FROM users WHERE unique_id = $1', [receiverId]);
          const senderRes = await db.query('SELECT username FROM users WHERE unique_id = $1', [senderId]);
          
          let sub = userRes.rows[0]?.push_subscription;
          if (sub) {
             if (typeof sub === 'string') {
               try { sub = JSON.parse(sub); } catch(e){ console.error("Push JSON Error:", e); }
             }
             
             // FIX: Validated JSON Structure to prevent Crash
             if (sub && typeof sub === 'object' && sub.endpoint) {
               const payload = JSON.stringify({
                 title: senderRes.rows[0]?.username || 'New Message',
                 body: content,
                 icon: '/logo.png',
                 url: `/chat/${senderId}`
               });
               
               webpush.sendNotification(sub, payload).then(() => {
                  db.query(`UPDATE messages SET status = 'delivered' WHERE id = $1`, [savedMsg.rows[0].id]);
                  io.to(senderId).emit('message_updated', { id: savedMsg.rows[0].id, status: 'delivered' });
               }).catch(async (e) => {
                  if (e.statusCode === 410 || e.statusCode === 404) {
                     await db.query(`UPDATE users SET push_subscription = NULL WHERE unique_id = $1`, [receiverId]);
                  }
               });
             }
          }
        } catch(err) { console.error('Push Query Error:', err.message); }
      }

      socket.emit('message_status', { tempId, realId: savedMsg.rows[0].id, status: initialStatus });
    } catch (err) { console.error("Send message root error:", err); }
  });
  
  // FIX: Replaced empty Catch blocks with Console Log to catch desyncs
  socket.on('react_message', async ({ messageId, reaction, receiverId }) => {
    try { 
      await db.query(`UPDATE messages SET reaction = $1 WHERE id = $2`, [reaction, messageId]); 
      io.to(receiverId).emit('message_updated', { id: messageId, reaction }); 
    } catch (err) { console.error("React message error:", err); }
  });

  socket.on('delete_message_everyone', async ({ messageId, receiverId }) => {
    try { 
      await db.query(`UPDATE messages SET is_deleted_for_everyone = TRUE, content = 'This message was deleted' WHERE id = $1`, [messageId]); 
      io.to(receiverId).emit('message_updated', { id: messageId, is_deleted_for_everyone: true, content: 'This message was deleted' }); 
    } catch (err) { console.error("Delete for everyone error:", err); }
  });

  socket.on('mark_as_read', async ({ messageId, senderId }) => {
    try { 
      await db.query(`UPDATE messages SET status = 'read' WHERE id = $1`, [messageId]); 
      io.to(senderId).emit('message_updated', { id: messageId, status: 'read' }); 
    } catch (err) { console.error("Mark as read error:", err); }
  });

  // ✅ FIX (Root Cause 2): Frontend se Delivery Acknowledgement sunne ke liye taaki sender ko DOUBLE TICK dikhe
  socket.on('message_delivered', async ({ messageId, senderId }) => {
    try {
      await db.query(`UPDATE messages SET status = 'delivered' WHERE id = $1`, [messageId]);
      io.to(senderId).emit('message_updated', { id: messageId, status: 'delivered' });
    } catch (err) { 
      console.error("Delivery status error:", err); 
    }
  });

  // ✅ NAYA CODE: Frontend se Delivery Acknowledgement sunne ke liye
  socket.on('message_delivered', async ({ messageId, senderId }) => {
    try {
      await db.query(`UPDATE messages SET status = 'delivered' WHERE id = $1`, [messageId]);
      io.to(senderId).emit('message_updated', { id: messageId, status: 'delivered' });
    } catch (err) { 
      console.error("Delivery status error:", err); 
    }
  });

  socket.on('mark_chat_read', async ({ senderId, receiverId }) => {
    try {
      await db.query(`UPDATE messages SET status = 'read' WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`, [senderId, receiverId]);
      io.to(senderId).emit('messages_read_bulk', { readerId: receiverId });
    } catch (err) { console.error("Error in bulk read:", err); }
  });

  socket.on('check_companion_status', async ({ targetId }) => {
    try {
      const u = await db.query(`SELECT last_seen, hide_last_seen, hide_online_status FROM users WHERE unique_id = $1`, [targetId]);
      if (u.rows.length > 0) {
        if (u.rows[0].hide_online_status) {
          socket.emit('companion_status_result', { targetId, isOnline: false, lastSeen: u.rows[0].hide_last_seen ? null : u.rows[0].last_seen });
          return;
        }
        // Check if ANY device is online
        const isTargetOnline = onlineUsers.has(targetId) && onlineUsers.get(targetId) > 0;
        socket.emit('companion_status_result', { targetId, isOnline: isTargetOnline, lastSeen: (isTargetOnline || u.rows[0].hide_last_seen) ? null : u.rows[0].last_seen });
      }
    } catch(e) { console.error("Companion check error:", e); }
  });
  
  socket.on('disconnect', async () => { 
    if (socket.userId) { 
      const currentCount = onlineUsers.get(socket.userId) || 0;
      const newCount = Math.max(0, currentCount - 1);
      
      if (newCount === 0) {
        // Sirf tabhi offline show karein jab User ke saare devices disconnect ho jayein
        onlineUsers.delete(socket.userId); 
        try {
          await db.query(`UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE unique_id = $1`, [socket.userId]);
          const u = await db.query('SELECT hide_online_status FROM users WHERE unique_id = $1', [socket.userId]);
          if (!u.rows[0]?.hide_online_status) {
             io.emit('user_offline', { userId: socket.userId, lastSeen: new Date().toISOString() }); 
          }
        } catch(err) { console.error("Disconnect error:", err); }
      } else {
        onlineUsers.set(socket.userId, newCount);
      }
    } 
  });
});

server.listen(process.env.PORT || 5000, () => console.log(`🚀 ChatVerse Backend Running!`));