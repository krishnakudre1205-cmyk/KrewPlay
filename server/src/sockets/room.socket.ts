import { Server, Socket } from "socket.io";
import {
  getRoom,
  getAllRooms,
} from "../services/room.service";

let syncIntervalStarted = false;

export function registerRoomEvents(
  io: Server,
  socket: Socket
) {

  // Start only ONE periodic sync
  if (!syncIntervalStarted) {
    syncIntervalStarted = true;

    setInterval(() => {
      for (const room of getAllRooms().values()) {
        io.to(room.code).emit(
          "player-state",
          room.player
        );
      }
    }, 5000);
  }

  // ===========================
  // JOIN ROOM
  // ===========================

  socket.on(
    "join-room",
    ({
      roomCode,
      participantId,
    }: {
      roomCode: string;
      participantId: string;
    }) => {

      socket.join(roomCode);

      console.log(
        `${socket.id} (${participantId}) joined ${roomCode}`
      );

      io.to(roomCode).emit("user-joined", {
        socketId: socket.id,
        participantId,
        roomCode,
      });

      const room = getRoom(roomCode);

      if (room) {
        socket.emit("player-state", room.player);
      }
    }
  );

  // ===========================
  // CHAT
  // ===========================

  socket.on(
    "send-message",
    ({
      roomCode,
      participantName,
      message,
    }: {
      roomCode: string;
      participantName: string;
      message: string;
    }) => {

      io.to(roomCode).emit("new-message", {
        participantName,
        message,
        time: new Date().toLocaleTimeString(),
      });

    }
  );

  // ===========================
  // PLAYER SYNC
  // ===========================

  socket.on(
    "player-sync",
    ({
      roomCode,
      participantName,
      action,
      player,
    }: {
      roomCode: string;
      participantName: string;

      action:
        | "play"
        | "pause"
        | "seek"
        | "speed";

      player: {
        isPlaying: boolean;
        currentTime: number;
        playbackRate: number;
        lastUpdated: number;
      };
    }) => {

      const room = getRoom(roomCode);

      if (!room) return;

      // Update shared state
      room.player = player;

      // Broadcast updated state
      io.to(roomCode).emit("player-sync", {
        participantName,
        action,
        player,
      });

    }
  );
}