import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { enableTouchDrag } from './touch'
import { installImeGuard } from './ime'
import { installDragAutoScroll } from './dnd'
import { AuthGate } from './components/AuthGate'

enableTouchDrag()
installImeGuard()
installDragAutoScroll()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>{(account) => <App account={account} />}</AuthGate>
  </StrictMode>,
)
