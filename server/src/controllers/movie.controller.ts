import { Request, Response } from "express";
import fs from "fs";
import { getRoom } from "../services/room.service";

export function uploadMovieController(req: Request, res: Response) {
  const { code } = req.params;

  const room = getRoom(code);

  if (!room) {
    return res.status(404).json({
      message: "Room not found",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      message: "Movie file is required",
    });
  }

  room.moviePath = req.file.path;
  room.movieName = req.file.originalname;
  room.movieSize = req.file.size;
  room.mimeType = req.file.mimetype;

  return res.json({
    success: true,
    movie: {
      name: room.movieName,
      size: room.movieSize,
      type: room.mimeType,
    },
  });
}

export function streamMovieController(req: Request, res: Response) {
  const { code } = req.params;

  const room = getRoom(code);

  if (!room || !room.moviePath) {
    return res.status(404).json({
      message: "Movie not found",
    });
  }

  const moviePath = room.moviePath;

  if (!fs.existsSync(moviePath)) {
    return res.status(404).json({
      message: "Movie file missing",
    });
  }

  const stat = fs.statSync(moviePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const mimeType = room.mimeType || "video/mp4";

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mimeType,
    });

    fs.createReadStream(moviePath).pipe(res);
    return;
  }

  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + 1024 * 1024, fileSize - 1);

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": mimeType,
  });

  fs.createReadStream(moviePath, {
    start,
    end,
  }).pipe(res);
}