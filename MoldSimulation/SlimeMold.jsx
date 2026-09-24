import SlimeMold from "./SlimeMoldLinker";

import { Link } from 'react-router-dom'

function SlimeMoldPage() {
  return (
    <>
      <>
        <div id="header">
          <h1>Slime Mold</h1>
        </div>
        <div>
          <Link to="/">Home</Link><br />
          <SlimeMold />
        </div>
      </>
    </>
  )
}

export default SlimeMoldPage;
