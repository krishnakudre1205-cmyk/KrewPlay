import { Request, Response } from "express";
import fs from "fs";
import http from "http";
import https from "https";
import { getRoom } from "../services/room.service";
import { saveHistory, getContinueWatchingList, saveContinueWatching, deleteContinueWatching } from "../utils/db";
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

function extractMovieThumbnail(moviePath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(moviePath)
      .screenshots({
        timestamps: ["5%"],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: "854x?"
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        console.warn(`Failed to extract thumbnail:`, err.message);
        reject(err);
      });
  });
}

export async function extractMediaMetadataForLibrary(moviePath: string): Promise<{ audioTracks: any[]; subtitleTracks: any[] }> {
  if (!moviePath) return { audioTracks: [], subtitleTracks: [] };

  try {
    const thumbPath = `${moviePath}_thumb.jpg`;
    try {
      if (!fs.existsSync(thumbPath)) {
        await extractMovieThumbnail(moviePath, thumbPath);
        console.log(`[FFmpeg] Extracted thumbnail for: ${moviePath}`);
      }
    } catch (err) {
      console.warn(`[FFmpeg] Skipping thumbnail generation:`, err);
    }

    const metadata = await probeFile(moviePath);
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

        const outputPath = `${moviePath}_track_${s.index}.vtt`;

        try {
          if (!fs.existsSync(outputPath)) {
            await extractSubtitle(moviePath, s.index, outputPath);
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

    return { audioTracks, subtitleTracks };
  } catch (err) {
    console.error("Error extracting media metadata:", err);
    return { audioTracks: [], subtitleTracks: [] };
  }
}

export async function extractMediaMetadata(room: any) {
  if (!room.moviePath) return;

  try {
    const { audioTracks, subtitleTracks } = await extractMediaMetadataForLibrary(room.moviePath);
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
      } catch (err) { }
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

import { getMovieFromLibrary } from "../utils/db";

export async function selectLibraryMovieController(req: Request, res: Response) {
  const { code } = req.params;
  const { libraryId } = req.body;

  const room = getRoom(code as string);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (!libraryId) {
    return res.status(400).json({ message: "Library ID is required" });
  }

  const record = await getMovieFromLibrary(libraryId);
  if (!record) {
    return res.status(404).json({ message: "Movie not found in library" });
  }

  if (!fs.existsSync(record.moviePath)) {
    return res.status(404).json({ message: "Movie file is missing from disk" });
  }

  room.moviePath = record.moviePath;
  room.movieName = record.movieName;
  room.movieSize = record.size;
  room.mimeType = record.mimeType;
  room.movieUrl = undefined;
  room.audioTracks = record.audioTracks || [];
  room.subtitleTracks = record.subtitleTracks || [];
  room.selectedAudioTrackIndex = room.audioTracks.length > 0 ? room.audioTracks[0].index : undefined;

  // Record history
  if (room.participants) {
    for (const p of room.participants) {
      if (p.userId) {
        const coWatchers = room.participants
          .filter((other) => other.userId !== p.userId && other.connected)
          .map((other) => other.name);

        saveHistory({
          id: randomUUID(),
          userId: p.userId,
          movieName: room.movieName,
          filename: path.basename(room.moviePath),
          watchedAt: new Date().toISOString(),
          isHost: p.isHost,
          coWatchers: coWatchers,
        }).catch((err) => console.error("Error logging library stream history:", err));
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

export function serveThumbnailController(req: Request, res: Response) {
  const { code } = req.params;
  const room = getRoom(code as string);

  if (!room || !room.moviePath) {
    return res.status(404).json({ message: "Room or movie not found" });
  }

  const thumbPath = `${room.moviePath}_thumb.jpg`;
  if (!fs.existsSync(thumbPath)) {
    return res.status(404).json({ message: "Thumbnail not found" });
  }

  res.setHeader("Content-Type", "image/jpeg");
  return res.sendFile(thumbPath);
}

function cleanMovieTitle(filename: string): { title: string; year?: string } {
  let name = filename.replace(/\.[a-zA-Z0-9]+$/, "");
  name = name.replace(/[-._]/g, " ");

  const noisePatterns = [
    /\b\d{3,4}p\b/i,
    /\b(x264|x265|hevc|h264|h265|avc|h263|divx|xvid)\b/i,
    /\b(bluray|brrip|bdrip|dvdrip|webrip|webdl|web\s*dl|hdrip|hdtv|vodrip|workprint)\b/i,
    /\b(aac|ac3|dts|dd5\.1|dd\+5\.1|truehd|atmos|mp3|eac3)\b/i,
    /\b(hindi|english|dual|audio|multi|sub|esub|msub|subbed|dubbed|dub)\b/i,
    /\b(10bit|8bit|hdr|sdr|dv|dolby\s*vision|atmos|imx)\b/i,
    /\b(season|s\d+e\d+|s\d+|e\d+|ep\d+|episode|complete|series)\b/i,
    /\b(yts|yify|tgx|galaxytv|psa|qxr|pahe|utr|hub4u|ms)\b/i,
    /\b(extended|director\s*s\s*cut|uncut|remastered|imax)\b/i
  ];

  for (const pattern of noisePatterns) {
    name = name.replace(pattern, " ");
  }

  let year: string | undefined;
  const yearMatch = name.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
    const idx = name.indexOf(year);
    if (idx > 0) {
      name = name.substring(0, idx);
    }
  }

  name = name.replace(/\s+/g, " ").trim();
  if (!name) {
    name = filename.replace(/\.[a-zA-Z0-9]+$/, "").trim();
  }

  return { title: name, year };
}

async function searchTMDBPoster(title: string, year?: string): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const yearParam = year ? `&year=${year}` : "";
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(title)}${yearParam}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const bestMatch = data.results.find((r: any) => r.poster_path && (r.media_type === "movie" || r.media_type === "tv"));
      const fallbackMatch = data.results.find((r: any) => r.poster_path);
      const match = bestMatch || fallbackMatch || data.results[0];
      if (match && match.poster_path) {
        return `https://image.tmdb.org/t/p/w500${match.poster_path}`;
      }
    }
  } catch (err) {
    console.error("TMDB API Error:", err);
  }
  return null;
}

async function searchTVmazePoster(title: string): Promise<string | null> {
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.image && data.image.medium) {
      return data.image.medium;
    }
  } catch (err) {
    // silent fail
  }
  return null;
}

async function searchInternetPoster(title: string, year?: string): Promise<string | null> {
  try {
    const query = `${title} ${year || ""} official movie poster site:image.tmdb.org/t/p/`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    const tmdbRegex = /https:\/\/image\.tmdb\.org\/t\/p\/[a-zA-Z0-9_]+\/[a-zA-Z0-9_.]+\.(jpg|png|jpeg)/g;
    const matches = html.match(tmdbRegex);
    if (matches && matches.length > 0) {
      let url = matches[0];
      url = url.replace(/\/t\/p\/[a-zA-Z0-9_]+\//, "/t/p/w500/");
      return url;
    }
  } catch (err) {
    console.error("Internet image search error:", err);
  }
  return null;
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to download, status: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export async function servePosterController(req: Request, res: Response) {
  const { code } = req.params;
  const room = getRoom(code as string);

  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  const movieName = room.movieName || "";
  const moviePath = room.moviePath;

  if (!movieName) {
    return res.status(404).json({ message: "No movie active in room" });
  }

  // 1. Check local cache
  if (moviePath) {
    const cachedPosterPath = `${moviePath}_poster.jpg`;
    if (fs.existsSync(cachedPosterPath)) {
      res.setHeader("Content-Type", "image/jpeg");
      return res.sendFile(cachedPosterPath);
    }
  }

  // 2. Perform search
  try {
    const { title, year } = cleanMovieTitle(movieName);
    console.log(`[Poster Search] Query: "${title}" (Year: ${year || "N/A"})`);

    let posterUrl: string | null = null;

    if (process.env.TMDB_API_KEY) {
      posterUrl = await searchTMDBPoster(title, year);
    }

    if (!posterUrl) {
      posterUrl = await searchTVmazePoster(title);
    }

    if (!posterUrl) {
      posterUrl = await searchInternetPoster(title, year);
    }

    if (posterUrl) {
      if (moviePath) {
        const cachedPosterPath = `${moviePath}_poster.jpg`;
        try {
          await downloadFile(posterUrl, cachedPosterPath);
          console.log(`[Poster Search] Cached poster to ${cachedPosterPath}`);
          res.setHeader("Content-Type", "image/jpeg");
          return res.sendFile(cachedPosterPath);
        } catch (downloadErr) {
          console.error(`[Poster Search] Failed to download poster:`, downloadErr);
        }
      }
      return res.redirect(posterUrl);
    }
  } catch (err) {
    console.error(`[Poster Search] Error:`, err);
  }

  return res.status(404).json({ message: "Poster not found" });
}

export async function getContinueWatchingController(req: Request, res: Response) {
  const userId = req.params.userId as string;
  try {
    const list = await getContinueWatchingList(userId);
    return res.json({ success: true, list });
  } catch (err) {
    console.error("Error fetching continue watching list:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function saveContinueWatchingController(req: Request, res: Response) {
  const { userId, movieId, movieTitle, poster, duration, currentPosition, lastRoomCode, isHost } = req.body;

  if (!userId || !movieId || !movieTitle) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    const record = await saveContinueWatching({
      userId,
      movieId,
      movieTitle,
      poster,
      duration: Number(duration) || 0,
      currentPosition: Number(currentPosition) || 0,
      lastRoomCode,
      isHost: Boolean(isHost),
    });
    res.status(200).json(record);
  } catch (error) {
    console.error("Save continue watching error:", error);
    res.status(500).json({ message: "Failed to save continue watching progress" });
  }
}

export async function deleteContinueWatchingController(req: Request, res: Response) {
  try {
    const { userId, id } = req.params;
    
    if (!userId || !id) {
      return res.status(400).json({ message: "userId and record id are required" });
    }

    const success = await deleteContinueWatching(userId, id);
    if (success) {
      return res.status(200).json({ message: "Record deleted successfully" });
    } else {
      return res.status(404).json({ message: "Record not found" });
    }
  } catch (error) {
    console.error("Delete continue watching error:", error);
    res.status(500).json({ message: "Failed to delete continue watching record" });
  }
}

async function fetchTMDBDetails(title: string, year?: string): Promise<any | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const yearParam = year ? `&year=${year}` : "";
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(title)}${yearParam}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    
    if (searchData.results && searchData.results.length > 0) {
      const match = searchData.results.find((r: any) => r.media_type === "movie" || r.media_type === "tv") || searchData.results[0];
      const id = match.id;
      const mediaType = match.media_type || "movie";
      
      const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${apiKey}&append_to_response=credits`;
      const detailsRes = await fetch(detailsUrl);
      if (!detailsRes.ok) return null;
      const details = await detailsRes.json();
      
      const cast = details.credits?.cast?.slice(0, 5).map((c: any) => c.name) || [];
      const director = details.credits?.crew?.find((c: any) => c.job === "Director")?.name || "N/A";
      const studio = details.production_companies?.[0]?.name || "N/A";
      
      return {
        poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
        title: details.title || details.name || title,
        year: (details.release_date || details.first_air_date || "").substring(0, 4) || year || "",
        runtime: details.runtime ? `${details.runtime} min` : details.episode_run_time?.[0] ? `${details.episode_run_time[0]} min` : "N/A",
        imdbRating: details.vote_average ? details.vote_average.toFixed(1) : "N/A",
        tmdbRating: details.vote_average ? details.vote_average.toFixed(1) : "N/A",
        genres: details.genres?.map((g: any) => g.name) || [],
        overview: details.overview || "",
        languages: details.spoken_languages?.map((l: any) => l.english_name) || [],
        cast,
        director,
        studio,
        backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : undefined,
      };
    }
  } catch (err) {
    console.error("Error fetching TMDB details:", err);
  }
  return null;
}

async function fetchOMDbDetails(title: string, year?: string): Promise<any | null> {
  const apiKey = process.env.OMDB_API_KEY || "3a65e771";
  try {
    const yearParam = year ? `&y=${year}` : "";
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}${yearParam}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.Response === "True") {
      return {
        poster: data.Poster !== "N/A" ? data.Poster : undefined,
        title: data.Title || title,
        year: data.Year || year || "",
        runtime: data.Runtime || "N/A",
        imdbRating: data.imdbRating || "N/A",
        tmdbRating: data.imdbRating || "N/A",
        genres: data.Genre ? data.Genre.split(", ") : [],
        overview: data.Plot || "",
        languages: data.Language ? data.Language.split(", ") : [],
        cast: data.Actors ? data.Actors.split(", ").slice(0, 5) : [],
        director: data.Director || "N/A",
        studio: data.Production || "N/A",
        backdrop: undefined
      };
    }
  } catch (err) {
    // silent fail
  }
  return null;
}

async function fetchTVmazeDetails(title: string): Promise<any | null> {
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed=cast`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const details = await res.json();
    
    const cast = details._embedded?.cast?.slice(0, 5).map((c: any) => c.person?.name) || [];
    const genres = details.genres || [];
    
    return {
      poster: details.image?.medium || details.image?.original,
      title: details.name || title,
      year: (details.premiered || "").substring(0, 4) || "",
      runtime: details.runtime ? `${details.runtime} min` : "N/A",
      imdbRating: details.rating?.average ? details.rating.average.toFixed(1) : "N/A",
      tmdbRating: details.rating?.average ? details.rating.average.toFixed(1) : "N/A",
      genres,
      overview: details.summary ? details.summary.replace(/<[^>]*>/g, "") : "",
      languages: [details.language || "English"],
      cast,
      director: "N/A",
      studio: details.network?.name || details.webChannel?.name || "N/A",
      backdrop: undefined
    };
  } catch (err) {
    // silent fail
  }
  return null;
}

export async function serveDetailsController(req: Request, res: Response) {
  const { code } = req.params;
  const room = getRoom(code as string);

  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  const movieName = room.movieName || "";
  const moviePath = room.moviePath;

  if (!movieName) {
    return res.status(404).json({ message: "No movie active in room" });
  }

  // 1. Check local cache first
  if (moviePath) {
    const cachedDetailsPath = `${moviePath}_details.json`;
    if (fs.existsSync(cachedDetailsPath)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(cachedDetailsPath, "utf8"));
        return res.json({ success: true, details: cachedData });
      } catch (err) {
        console.error("Error reading details cache:", err);
      }
    }
  }

  // 2. Perform search
  try {
    const { title, year } = cleanMovieTitle(movieName);
    console.log(`[Details Search] Query: "${title}" (Year: ${year || "N/A"})`);

    let details: any = null;

    if (process.env.TMDB_API_KEY) {
      details = await fetchTMDBDetails(title, year);
    }

    if (!details) {
      details = await fetchOMDbDetails(title, year);
    }

    if (!details) {
      details = await fetchTVmazeDetails(title);
    }

    // 3. Fallback layout if API lookup fails
    if (!details) {
      details = {
        title: title,
        year: year || "N/A",
        runtime: "N/A",
        imdbRating: "N/A",
        tmdbRating: "N/A",
        genres: ["Cinema"],
        overview: "Movie details unavailable.",
        languages: ["English"],
        cast: [],
        director: "N/A",
        studio: "N/A",
        poster: undefined,
        backdrop: undefined,
      };
    }

    // Cache to disk if moviePath is set
    if (moviePath) {
      const cachedDetailsPath = `${moviePath}_details.json`;
      try {
        fs.writeFileSync(cachedDetailsPath, JSON.stringify(details, null, 2), "utf8");
        console.log(`[Details Search] Cached details locally to ${cachedDetailsPath}`);
      } catch (writeErr) {
        console.error(`[Details Search] Failed to write cache:`, writeErr);
      }
    }

    return res.json({ success: true, details });
  } catch (err) {
    console.error(`[Details Search] Error:`, err);
    return res.json({
      success: true,
      details: {
        title: movieName,
        year: "N/A",
        runtime: "N/A",
        imdbRating: "N/A",
        tmdbRating: "N/A",
        genres: ["Cinema"],
        overview: "Movie details unavailable.",
        languages: ["English"],
        cast: [],
        director: "N/A",
        studio: "N/A",
      }
    });
  }
}