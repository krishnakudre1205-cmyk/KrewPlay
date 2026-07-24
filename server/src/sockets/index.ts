import { Server } from "socket.io";
import { registerRoomEvents } from "./room.socket";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    console.log(`🟢 User Connected: ${socket.id}`);

    registerRoomEvents(io, socket);

    socket.on("disconnect", () => {
      console.log(`🔴 User Disconnected: ${socket.id}`);
    });
  });
}