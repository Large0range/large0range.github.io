import FallingSand from "./FallingSandLinker";

import { Link } from 'react-router-dom'

function FallingSandPage() {
  return (
    <>
      <>
        <h1 id="falling-sand-information">Click Anywhere</h1>
        <div id="Controls">
          <h1 style={{ color: 'white'}}>Falling Sand</h1>
          <Link to="/">Home</Link><br />
        </div>
        <div>
          <FallingSand />
        </div>
      </>
    </>
  )
}

export default FallingSandPage;
