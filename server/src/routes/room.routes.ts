import { Router } from "express";
import {
  createRoomController,
  getRoomController,
  joinRoomController,
  leaveRoomController,
} from "../controllers/room.controller";

const router = Router();

router.post("/", createRoomController);

router.get("/:code", getRoomController);

router.post("/:code/join", joinRoomController);

router.post("/:code/leave", leaveRoomController);

export default router;