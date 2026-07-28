import { Router } from "express";
import { upload } from "../config/multer";
import {
  uploadMovieController,
  setMovieUrlController,
  streamMovieController,
  serveSubtitleController,
  selectLibraryMovieController,
  serveThumbnailController,
  servePosterController,
  getContinueWatchingController,
  saveContinueWatchingController,
  deleteContinueWatchingController,
  serveDetailsController,
} from "../controllers/movie.controller";

const router = Router();

router.post("/:code/set-url", setMovieUrlController);
router.post("/:code/select-library", selectLibraryMovieController);

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

router.get(
  "/:code/thumbnail",
  serveThumbnailController
);

router.get(
  "/:code/poster",
  servePosterController
);

router.get(
  "/:code/details",
  serveDetailsController
);

router.get(
  "/continue-watching/:userId",
  getContinueWatchingController
);

router.post(
  "/continue-watching",
  saveContinueWatchingController
);

router.delete(
  "/continue-watching/:userId/:id",
  deleteContinueWatchingController
);

export default router;