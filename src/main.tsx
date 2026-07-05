import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyUiScale } from './lib/uiScale'
import './lib/undoManager' // installs global Ctrl+Z / Ctrl+Y + records nn-* changes

// Apply the saved UI scale before first paint so there's no flash.
applyUiScale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
