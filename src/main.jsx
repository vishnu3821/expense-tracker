import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import { initPWAInstallListener } from './utils/pwaInstall'

// Initialize PWA install prompt listener as early as possible
initPWAInstallListener()

// Register the PWA service worker
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

