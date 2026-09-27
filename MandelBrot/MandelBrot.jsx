import MandelBrot from "./MandelBrotLinker";

import { Link } from 'react-router-dom'

function MandelBrotPage() {
  return (
    <>
      <>
        <div id="Controls">
          <h1 style={{ color: 'white'}}>Mandel Brot Set</h1>
          <Link to="/">Home</Link><br />
        </div>
        <div>
          <MandelBrot />
        </div>
      </>
    </>
  )
}

export default MandelBrotPage;
