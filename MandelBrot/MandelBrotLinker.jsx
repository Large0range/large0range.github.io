import { useEffect } from "react";
import { useRef } from "react";
import { initMandelBrot } from "./main";


function MandelBrot() {
  const containerRef = useRef(null);

  useEffect(() => {
    let cleanupFn;
    let cancelled = false;

    initMandelBrot(containerRef.current).then((cleanup) => {
      if (cancelled) {
        cleanup(); // unmounted before init finished — dispose immediately
      } else {
        cleanupFn = cleanup;
      }
    })

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
    }
  }, [])

  return <div className="sim-background" ref={containerRef} />
}

export default MandelBrot;
