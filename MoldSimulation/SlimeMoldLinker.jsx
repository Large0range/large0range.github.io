import { useEffect } from "react";
import { useRef } from "react";
import { initSlimeMold } from "./main";

function SlimeMold() {
  const containerRef = useRef(null);

  useEffect(() => {
    let cleanupFn;
    let cancelled = false;

    initSlimeMold(containerRef.current).then((cleanup) => {
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

  return <div ref={containerRef} />
}

export default SlimeMold;
