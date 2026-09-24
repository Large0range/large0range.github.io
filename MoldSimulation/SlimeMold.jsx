import SlimeMold from "./SlimeMoldLinker";

import { Link } from 'react-router-dom'

function SlimeMoldPage() {
  return (
    <>
      <>
        <div id="Controls">
          <h1 style={{ color: 'white'}}>Slime Mold</h1>
          <Link to="/">Home</Link><br />
        </div>
        <div>
          <SlimeMold />
        </div>
      </>
    </>
  )
}

export default SlimeMoldPage;
