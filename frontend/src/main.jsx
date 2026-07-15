import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // 👈 YE NAYA IMPORT HAI
import App from './App.jsx'
import './index.css'

// frontend/src/main.jsx me purane SW registration ko isse replace karo

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      
      // Update check karne ka logic
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          // Agar naya code install ho gaya hai aur purana chal raha hai
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // App ko batao ki naya update aa gaya hai
            window.dispatchEvent(new CustomEvent('pwa-update-available'));
          }
        });
      });

    }).catch(err => console.log('SW registration failed', err));
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