import { useState } from 'react'
import './App.css'
import { Link } from 'react-router-dom'

function App() {

  return (
    <>
      <div id="header">
        <h1>Simulation Site</h1>
        <span>This site is purely just for my coding projects that I want a place to host and access all in one place</span>
      </div>

      <div id="simulation-grid">
        <Link to="/slime-mold">Mold</Link>
        <Link to="/falling-sand">Falling Sand</Link>
      </div>
    </>
  )
}

export default App
