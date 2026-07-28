import { Router } from "express";
import {
  getLibraryController,
  deleteFromLibraryController,
  renameLibraryMovieController,
  initUploadController,
  uploadChunkController,
  completeUploadController
} from "../controllers/library.controller";

const router = Router();

router.get("/:userId", getLibraryController);
router.post("/:userId/upload/init", initUploadController);
router.post("/:userId/upload/chunk/:uploadId", uploadChunkController);
router.post("/:userId/upload/complete/:uploadId", completeUploadController);
router.delete("/:userId/:id", deleteFromLibraryController);
router.patch("/:userId/:id", renameLibraryMovieController);

export default router;
