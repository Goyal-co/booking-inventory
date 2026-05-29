"use client";

import { useEffect, useState } from "react";

export function useGridColumns(maxColumns = 5) {
  const [columns, setColumns] = useState(maxColumns >= 4 ? 4 : maxColumns);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280 && maxColumns >= 5) setColumns(5);
      else if (w >= 1024) setColumns(Math.min(4, maxColumns));
      else if (w >= 768) setColumns(Math.min(3, maxColumns));
      else if (w >= 640) setColumns(Math.min(2, maxColumns));
      else setColumns(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [maxColumns]);

  return columns;
}
