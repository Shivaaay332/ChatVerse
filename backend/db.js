const { Pool } = require('pg');
require('dotenv').config();

// 1. .env se DATABASE_URL fetch karo
let connectionUrl = process.env.DATABASE_URL;

// 2. FIX: Warning hatane ke liye URL me se 'sslmode' wale words hata do
// Kyunki hum niche manually ssl object pass kar rahe hain
if (connectionUrl) {
  connectionUrl = connectionUrl.replace('?sslmode=require', '').replace('&sslmode=require', '');
}

const pool = new Pool({
  connectionString: connectionUrl,
  ssl: { 
    rejectUnauthorized: false 
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};