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



    socket.on("start-countdown", ({ roomCode }) => {
    io.to(roomCode).emit("start-countdown");
});


socket.on(
  "reaction",
  ({ roomCode, emoji, participantName }) => {
    io.to(roomCode).emit("reaction", {
      emoji,
      participantName,
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

socket.on(
  "player-skip",
  ({
    roomCode,
    participantName,
    direction,
    player,
  }: {
    roomCode: string;
    participantName: string;
    direction: "forward" | "backward";
    player: {
      isPlaying: boolean;
      currentTime: number;
      playbackRate: number;
      lastUpdated: number;
    };
  }) => {
    const room = getRoom(roomCode);

    if (!room) return;

    room.player = player;

    io.to(roomCode).emit("player-skip", {
      participantName,
      direction,
      player,
    });
  }
);
let controlsLocked = false;
let lockedBy = "";
socket.on(
  "toggle-lock",
  ({
    roomCode,
    participantName,
  }: {
    roomCode: string;
    participantName: string;
  }) => {

    controlsLocked = !controlsLocked;

    lockedBy = controlsLocked
      ? participantName
      : "";

    io.to(roomCode).emit("lock-state", {
      locked: controlsLocked,
      lockedBy,
    });

  }
);


socket.on("leave-room", ({ roomCode }) => {
  socket.leave(roomCode);

  const room = getRoom(roomCode);

io.to(roomCode).emit(
    "user-left",
    room
);
});

socket.on(
    "host-changed",
    ({
        roomCode,
        newHost,
    }) => {

        io.to(roomCode).emit(
            "host-changed",
            newHost
        );
    }
);
  // ===========================
// VOICE CHAT (WebRTC Signaling)
// ===========================

socket.on(
  "voice-join",
  ({ roomCode }: { roomCode: string }) => {
    socket.join(roomCode);

    socket.to(roomCode).emit("voice-user-joined", {
      socketId: socket.id,
    });
  }
);

socket.on(
  "voice-offer",
  ({
    roomCode,
    target,
    offer,
  }: {
    roomCode: string;
    target: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    io.to(target).emit("voice-offer", {
      from: socket.id,
      offer,
    });
  }
);

socket.on(
  "voice-answer",
  ({
    target,
    answer,
  }: {
    target: string;
    answer: RTCSessionDescriptionInit;
  }) => {
    io.to(target).emit("voice-answer", {
      from: socket.id,
      answer,
    });
  }
);

socket.on(
  "voice-ice-candidate",
  ({
    target,
    candidate,
  }: {
    target: string;
    candidate: RTCIceCandidateInit;
  }) => {
    console.log(
  "ICE",
  socket.id,
  "->",
  target
);
    io.to(target).emit("voice-ice-candidate", {
      from: socket.id,
      candidate,
    });
  }
);

socket.on("disconnect", () => {
  io.emit("voice-user-left", socket.id);
});
}