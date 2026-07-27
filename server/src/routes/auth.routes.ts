import { Router } from "express";
import { 
  registerController, 
  loginController, 
  getHistoryController, 
  clearHistoryController,
  recreateRoomController,
  getAchievementsController,
  saveAvatarController
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/history/:userId", getHistoryController);
router.delete("/history/:userId", clearHistoryController);
router.post("/recreate", recreateRoomController);
router.get("/achievements/:userId", getAchievementsController);
router.post("/avatar", saveAvatarController);

export default router;
