import { Router } from "express";
import { upload } from "../config/multer";
import {
  uploadMovieController,
  setMovieUrlController,
  streamMovieController,
  serveSubtitleController,
} from "../controllers/movie.controller";

const router = Router();

router.post("/:code/set-url", setMovieUrlController);

router.post(
  "/:code/upload",
  upload.single("movie"),
  uploadMovieController
);

router.get(
  "/:code/stream",
  streamMovieController
);

router.get(
  "/:code/subtitles/:index",
  serveSubtitleController
);

export default router;