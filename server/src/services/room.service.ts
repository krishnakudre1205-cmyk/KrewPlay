import { randomUUID } from "crypto";
import { Room, Participant } from "../types/room";
import { saveHistory } from "../utils/db";
import path from "path";

async function recordHistory(
  userId: string, 
  movieName: string, 
  moviePath: string, 
  isHost: boolean, 
  coWatchers: string[]
) {
  try {
    const filename = path.basename(moviePath);
    await saveHistory({
      id: randomUUID(),
      userId,
      movieName,
      filename,
      watchedAt: new Date().toISOString(),
      isHost,
      coWatchers,
    });
    console.log(`History entry recorded: user=${userId}, movie=${movieName}, isHost=${isHost}`);
  } catch (err) {
    console.error("Error recording history:", err);
  }
}

const rooms = new Map<string, Room>();

export function getAllRooms() {
  return rooms;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

export function createRoom(hostName: string, userId?: string, avatar?: { emoji: string; gradient: string }) {
  const hostId = randomUUID();

  const participant: Participant = {
    id: hostId,
    name: hostName,
    isHost: true,
    connected: true,
    joinedAt: new Date(),
    userId,
    avatar,
  };

  let roomCode: string;

  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  const room: Room = {
    code: roomCode,
    hostId,

    participants: [participant],

    player: {
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1,
      lastUpdated: Date.now(),
    },

    locked: false,
    lockedBy: "",

    theme: "minimal", // Default theme

    createdAt: new Date(),
  };

  rooms.set(room.code, room);

  console.log("Created room:", room.code);
  console.log("Rooms in memory:", [...rooms.keys()]);

  return room;
}

export function getRoom(code: string) {
  console.log("Looking for room:", code);
  console.log("Rooms in memory:", [...rooms.keys()]);

  return rooms.get(code);
}

export function joinRoom(code: string, name: string, userId?: string, avatar?: { emoji: string; gradient: string }) {
  console.log("Trying to join:", code);
  console.log("Rooms in memory:", [...rooms.keys()]);

  const room = rooms.get(code);

  if (!room) {
    return null;
  }

  if (room.participants.length >= 10) {
    return {
      error: "Room is full",
    };
  }

  const nameExists = room.participants.some(
    (participant) =>
      participant.name.toLowerCase() === name.toLowerCase()
  );

  if (nameExists) {
    return {
      error: "Participant name already exists",
    };
  }

  const participant: Participant = {
    id: randomUUID(),
    name,
    isHost: false,
    connected: true,
    joinedAt: new Date(),
    userId,
    avatar,
  };

  room.participants.push(participant);

  // If room already has a movie loaded, record this user's history
  if (userId && room.movieName && room.moviePath) {
    const coWatchers = room.participants
      .filter((p) => p.userId !== userId && p.connected)
      .map((p) => p.name);
    recordHistory(userId, room.movieName, room.moviePath, false, coWatchers);
  }

  return participant;
}

export function leaveRoom(
  code: string,
  participantId: string,
  newHostId?: string
) {
  const room = rooms.get(code);

  if (!room) {
    return {
      error: "Room not found",
    };
  }

  const participant = room.participants.find(
    p => p.id === participantId
  );

  if (!participant) {
    return {
      error: "Participant not found",
    };
  }

  // Host leaving
  if (participant.isHost) {

    // No new host selected
    if (!newHostId) {
      return {
        error: "Host must select a new host",
      };
    }

    const nextHost = room.participants.find(
      p =>
        p.id === newHostId &&
        p.connected &&
        p.id !== participantId
    );

    if (!nextHost) {
      return {
        error: "Invalid new host",
      };
    }

    nextHost.isHost = true;
    room.hostId = nextHost.id;

    participant.isHost = false;
    participant.connected = false;

    return {
      success: true,
      hostTransferred: true,
      newHost: nextHost,
    };
  }

  participant.connected = false;

  return {
    success: true,
  };
}