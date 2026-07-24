import { randomUUID } from "crypto";
import { Room, Participant } from "../types/room";

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

export function createRoom(hostName: string) {
  const hostId = randomUUID();

  const participant: Participant = {
    id: hostId,
    name: hostName,
    isHost: true,
    joinedAt: new Date(),
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

export function joinRoom(code: string, name: string) {
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
    joinedAt: new Date(),
  };

  room.participants.push(participant);

  return participant;
}

export function leaveRoom(code: string, participantId: string) {
  const room = rooms.get(code);

  if (!room) {
    return {
      error: "Room not found",
    };
  }

  const participantIndex = room.participants.findIndex(
    (participant) => participant.id === participantId
  );

  if (participantIndex === -1) {
    return {
      error: "Participant not found",
    };
  }

  const participant = room.participants[participantIndex];

  if (participant.isHost) {
    rooms.delete(code);

    return {
      roomDeleted: true,
    };
  }

  room.participants.splice(participantIndex, 1);

  return {
    success: true,
  };
}