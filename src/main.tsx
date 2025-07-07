import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { register as registerServiceWorker } from './serviceWorkerRegistration'
import { db } from './config/firebase'
import { ThemeProvider } from 'next-themes'
import LoggingService from './services/LoggingService'
import { setupFirebaseSecurity } from './utils/security'

// Initialize Firebase
if (process.env.NODE_ENV === 'development') {
  console.log('Firebase initialized:', db)
}

// Setup Firebase security measures
setupFirebaseSecurity();

// Override console methods in production
if (process.env.NODE_ENV === 'production') {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };

  // Override console methods to do nothing in production
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};

  // Keep user activity logging enabled in production
  // LoggingService.getInstance().disableLogging(); // Removed this line
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

// Register service worker for PWA support
registerServiceWorker({
  onSuccess: (registration) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('PWA registration successful', registration)
    }
  },
  onUpdate: (registration) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('New content is available; please refresh.', registration)
    }
  },
})
