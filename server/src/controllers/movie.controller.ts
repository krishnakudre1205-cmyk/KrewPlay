import { Request, Response } from "express";
import fs from "fs";
import { getRoom } from "../services/room.service";
import { saveHistory } from "../utils/db";
import { randomUUID } from "crypto";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
// @ts-ignore
import ffmpegPath from "ffmpeg-static";
// @ts-ignore
import ffprobeStatic from "ffprobe-static";

// Configure FFmpeg static paths
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

// Helper functions for metadata extraction
function probeFile(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function extractSubtitle(moviePath: string, streamIndex: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(moviePath)
      .map(`0:${streamIndex}`)
      .output(outputPath)
      .on("end", () => {
        console.log(`Extracted subtitle track ${streamIndex} to ${outputPath}`);
        resolve();
      })
      .on("error", (err) => {
        console.error(`Error extracting subtitle track ${streamIndex}:`, err);
        reject(err);
      })
      .run();
  });
}

export async function extractMediaMetadata(room: any) {
  if (!room.moviePath) return;

  try {
    const metadata = await probeFile(room.moviePath);
    const audioTracks: any[] = [];
    const subtitleTracks: any[] = [];

    for (const s of metadata.streams) {
      if (s.codec_type === "audio") {
        const title = s.tags?.title || s.tags?.TITLE || `Track ${audioTracks.length + 1}`;
        const lang = s.tags?.language || s.tags?.LANGUAGE || "und";
        audioTracks.push({
          index: s.index,
          language: lang,
          title: `${title} (${lang.toUpperCase()}) [${s.codec_name?.toUpperCase()}]`,
          codec: s.codec_name,
        });
      } else if (s.codec_type === "subtitle") {
        const title = s.tags?.title || s.tags?.TITLE || `Track ${subtitleTracks.length + 1}`;
        const lang = s.tags?.language || s.tags?.LANGUAGE || "und";
        
        const outputPath = `${room.moviePath}_track_${s.index}.vtt`;
        
        try {
          if (!fs.existsSync(outputPath)) {
            await extractSubtitle(room.moviePath, s.index, outputPath);
          }
          subtitleTracks.push({
            index: s.index,
            language: lang,
            title: `${title} (${lang.toUpperCase()}) [${s.codec_name?.toUpperCase()}]`,
            codec: s.codec_name,
          });
        } catch (err) {
          console.warn(`Skipping subtitle stream index ${s.index} due to extraction incompatibility:`, err);
        }
      }
    }

    room.audioTracks = audioTracks;
    room.subtitleTracks = subtitleTracks;
    room.selectedAudioTrackIndex = audioTracks.length > 0 ? audioTracks[0].index : undefined;
    console.log(`Media Metadata Probed for ${room.movieName}: ${audioTracks.length} audio tracks, ${subtitleTracks.length} subtitle tracks`);
  } catch (err) {
    console.error("Error extracting media metadata:", err);
  }
}

export async function uploadMovieController(req: Request, res: Response) {
  const { code } = req.params;

  const room = getRoom(code as string);

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

  // Probe metadata & extract subtitles WebVTTs
  await extractMediaMetadata(room);

  // Record history for any connected participants with a user ID
  if (room.participants && room.moviePath) {
    const filename = path.basename(room.moviePath);
    for (const p of room.participants) {
      if (p.userId) {
        const coWatchers = room.participants
          .filter((other) => other.userId !== p.userId && other.connected)
          .map((other) => other.name);

        saveHistory({
          id: randomUUID(),
          userId: p.userId,
          movieName: room.movieName,
          filename: filename,
          watchedAt: new Date().toISOString(),
          isHost: p.isHost,
          coWatchers: coWatchers,
        }).catch((err) => console.error("Error logging upload history:", err));
      }
    }
  }

  return res.json({
    success: true,
    movie: {
      name: room.movieName,
      size: room.movieSize,
      type: room.mimeType,
      audioTracks: room.audioTracks,
      subtitleTracks: room.subtitleTracks,
    },
  });
}

export function serveSubtitleController(req: Request, res: Response) {
  const { code, index } = req.params;
  const room = getRoom(code as string);
  
  if (!room || !room.moviePath) {
    return res.status(404).json({ message: "Room or movie not found" });
  }
  
  const vttPath = `${room.moviePath}_track_${index}.vtt`;
  if (!fs.existsSync(vttPath)) {
    return res.status(404).json({ message: "Subtitle track file not found" });
  }
  
  res.setHeader("Content-Type", "text/vtt");
  return res.sendFile(vttPath);
}

export function streamMovieController(req: Request, res: Response) {
  const { code } = req.params;
  const audioTrackQuery = req.query.audioTrack;

  const room = getRoom(code as string);

  if (!room) {
    return res.status(404).json({
      message: "Movie not found",
    });
  }

  if (room.movieUrl) {
    return res.redirect(room.movieUrl);
  }

  if (!room.moviePath) {
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

  // Check if a non-default audio track is active
  const selectedAudioTrack = audioTrackQuery ? parseInt(audioTrackQuery as string) : undefined;
  const defaultAudioTrack = room.audioTracks && room.audioTracks.length > 0 ? room.audioTracks[0].index : undefined;
  
  const shouldTranscode = selectedAudioTrack !== undefined && 
                          defaultAudioTrack !== undefined && 
                          selectedAudioTrack !== defaultAudioTrack;

  if (shouldTranscode) {
    console.log(`Dynamic audio transcoding active: mapping audio track index ${selectedAudioTrack}`);
    
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Transfer-Encoding": "chunked"
    });

    const command = ffmpeg(moviePath)
      .map("0:v:0")
      .map(`0:${selectedAudioTrack}`)
      .videoCodec("copy")
      .audioCodec("aac")
      .audioChannels(2)
      .outputFormat("mp4")
      .outputOptions([
        "-movflags frag_keyframe+empty_moov+default_base_moof",
        "-frag_duration 2000000"
      ])
      .on("error", (err) => {
        if (err.message.includes("pipe") || err.message.includes("Output stream closed")) {
          return;
        }
        console.error("FFmpeg stream error:", err.message);
      });

    command.pipe(res, { end: true });
    
    req.on("close", () => {
      try {
        command.kill("SIGKILL");
      } catch (err) {}
    });
    return;
  }

  // Serve static file range
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

export async function setMovieUrlController(req: Request, res: Response) {
  const { code } = req.params;
  const { movieUrl, movieName } = req.body;

  const room = getRoom(code as string);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (!movieUrl) {
    return res.status(400).json({ message: "Movie URL is required" });
  }

  room.movieUrl = movieUrl;
  room.movieName = movieName || "Shared Movie Stream";
  room.movieSize = 0;
  room.mimeType = "video/mp4";

  if (room.participants) {
    for (const p of room.participants) {
      if (p.userId) {
        const coWatchers = room.participants
          .filter((other) => other.userId !== p.userId && other.connected)
          .map((other) => other.name);

        saveHistory({
          id: randomUUID(),
          userId: p.userId,
          movieName: room.movieName || "Shared Movie Stream",
          filename: "stream-url",
          watchedAt: new Date().toISOString(),
          isHost: p.isHost,
          coWatchers: coWatchers,
        }).catch((err) => console.error("Error logging stream history:", err));
      }
    }
  }

  return res.json({
    success: true,
    movieName: room.movieName,
    movieUrl: room.movieUrl,
  });
}