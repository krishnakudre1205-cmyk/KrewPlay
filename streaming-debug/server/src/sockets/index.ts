import { Server } from "socket.io";
import { registerRoomEvents } from "./room.socket";

let ioInstance: Server | null = null;

export function registerSocketHandlers(io: Server) {
  ioInstance = io;
  io.on("connection", (socket) => {
    console.log(`🟢 User Connected: ${socket.id}`);

    registerRoomEvents(io, socket);

    socket.on("disconnect", () => {
      console.log(`🔴 User Disconnected: ${socket.id}`);
    });
  });
}

export function getIo() {
  return ioInstance;
}