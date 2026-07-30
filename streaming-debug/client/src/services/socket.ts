import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/api";

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

socket.on("connect", () => {
  console.log("🟢 Connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("🔴 Disconnected");
});