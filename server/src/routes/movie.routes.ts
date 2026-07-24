import { Router } from "express";
import { upload } from "../config/multer";
import {
  uploadMovieController,
  streamMovieController,
} from "../controllers/movie.controller";

const router = Router();

router.post(
  "/:code/upload",
  upload.single("movie"),
  uploadMovieController
);

router.get(
  "/:code/stream",
  streamMovieController
);

export default router;