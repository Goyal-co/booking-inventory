"use client";

import { useEffect, useState } from "react";

export function useUnreadNotifications() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications/unread-count")
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => setCount(0));
  }, []);

  return count;
}
