import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // 👈 YE NAYA IMPORT HAI
import App from './App.jsx'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.log('SW registration failed', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 👇 APP KO BROWSER ROUTER ME WRAP KIYA HAI 👇 */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)