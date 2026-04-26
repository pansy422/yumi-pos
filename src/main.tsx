import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import './index.css'

const el = document.getElementById('root')
if (!el) throw new Error('Falta #root')

createRoot(el).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
