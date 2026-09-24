import { useState } from 'react'
import './App.css'
import { Link } from 'react-router-dom'

function App() {

  return (
    <>
      <div id="header">
        <h1>Simulation Site</h1>
      </div>
      <div>
        <Link to="/slime-mold">Mold</Link><br />
        <span>Currently working on adding my simulations into the website here</span>
      </div>
    </>
  )
}

export default App
