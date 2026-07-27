import { Request, Response } from "express";
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
} from "../services/room.service";

export function createRoomController(req: Request, res: Response) {
  const { hostName, userId, avatar } = req.body;

  if (!hostName) {
    return res.status(400).json({
      message: "Host name required",
    });
  }

  const room = createRoom(hostName, userId, avatar);

  res.status(201).json(room);
}

export function getRoomController(req: Request, res: Response) {
  const room = getRoom(req.params.code as string);

  if (!room) {
    return res.status(404).json({
      message: "Room not found",
    });
  }

  res.json(room);
}

export function joinRoomController(req: Request, res: Response) {
  const { code } = req.params;
  const { name, userId, avatar } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      message: "Participant name is required",
    });
  }

  const result = joinRoom(code as string, name as string, userId as string, avatar);

  if (!result) {
    return res.status(404).json({
      message: "Room not found",
    });
  }

  if ("error" in result) {
    return res.status(400).json({
      message: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    participant: result,
  });
}

export function leaveRoomController(req: Request, res: Response) {
  const { code } = req.params;
  const {
    participantId,
    newHostId,
} = req.body;

  if (!participantId) {
    return res.status(400).json({
      message: "participantId is required",
    });
  }

  const result = leaveRoom(
    code as string,
    participantId as string,
    newHostId as string
  );

  if ("error" in result) {
    return res.status(404).json({
      message: result.error,
    });
  }

  if ("roomDeleted" in result) {
  return res.status(200).json({
    success: true,
    roomDeleted: true,
  });
}

if ("hostTransferred" in result) {
  return res.status(200).json(result);
}

  return res.status(200).json({
    success: true,
    message: "Participant left successfully.",
  });
}