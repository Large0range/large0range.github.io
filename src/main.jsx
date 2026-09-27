import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { HashRouter, Route, Routes } from 'react-router-dom'
import SlimeMoldPage from '../MoldSimulation/SlimeMold.jsx'
import FallingSandPage from '../FallingSand/FallingSand.jsx'
import MandelBrotPage from '../MandelBrot/MandelBrot.jsx'

createRoot(document.getElementById('root')).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/slime-mold" element={<SlimeMoldPage />} />
      <Route path="/falling-sand" element={<FallingSandPage />} />
      <Route path="/mandelbrot-set" element={<MandelBrotPage />} />
    </Routes>
  </HashRouter>
)
