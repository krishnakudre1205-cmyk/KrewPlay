import { Request, Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Temporary movie location.
 * Later this will come from the room instead of being hardcoded.
 */
const MOVIE_PATH = path.join(
  process.cwd(),
  "movies",
  "movie.mp4"
);

export function streamMovie(req: Request, res: Response) {
  if (!fs.existsSync(MOVIE_PATH)) {
    return res.status(404).json({
      message: "Movie not found",
    });
  }

  const stat = fs.statSync(MOVIE_PATH);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    });

    fs.createReadStream(MOVIE_PATH).pipe(res);
    return;
  }

  const CHUNK_SIZE = 1024 * 1024;

  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(
    start + CHUNK_SIZE,
    fileSize - 1
  );

  const contentLength = end - start + 1;

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  });

  fs.createReadStream(MOVIE_PATH, {
    start,
    end,
  }).pipe(res);
}