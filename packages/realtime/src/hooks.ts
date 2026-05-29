"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { RealtimeEventMap } from "./index";

export function useRealtime(projectId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const url = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";
    const socket = io(url, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join:project", projectId);
    });

    socket.on("disconnect", () => setIsConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  const subscribe = useCallback(
    <K extends keyof RealtimeEventMap>(
      event: K,
      handler: (payload: RealtimeEventMap[K]) => void
    ) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on(event as string, handler as (...args: any[]) => void);
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.off(event as string, handler as (...args: any[]) => void);
      };
    },
    []
  );

  return { subscribe, isConnected, socket: socketRef };
}
