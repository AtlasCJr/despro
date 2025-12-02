import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './src.css'
import './fonts.css'

import Main from './pages/main'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Main />
    </StrictMode>
)
