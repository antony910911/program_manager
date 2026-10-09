import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { enableTouchDrag } from './touch'
import { AuthGate } from './components/AuthGate'

enableTouchDrag()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>{(account) => <App account={account} />}</AuthGate>
  </StrictMode>,
)
