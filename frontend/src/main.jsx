import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Layout is designed for 1920x1080 at a 16px root font size. On smaller screens the root font
// size shrinks, and because all sizes are in rem the whole UI scales with it (crisp text, no zoom).
// DESIGN_W = the width (in 16px-units) that should fit the screen: bigger number = smaller UI.
const DESIGN_W = 1250
const DESIGN_H = 700
function applyScale() {
  const raw = Math.min(1, window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)
  // whole pixels only, so text and edges land on the pixel grid
  const px = Math.max(10, Math.round(16 * raw))
  document.documentElement.style.setProperty('--root-fs', px + 'px')
}
applyScale()
window.addEventListener('resize', applyScale)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
