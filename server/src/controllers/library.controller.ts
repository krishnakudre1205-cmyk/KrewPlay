import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { 
  LibraryRecord, 
  getUserLibrary, 
  deleteMovieFromLibrary, 
  renameMovieInLibrary,
  ignoreMovieFromLibrary,
  findMovieByHash,
  addMovieToLibrary,
  updateLibraryRecordStatus
} from "../utils/db";
import { scanUserLibrary } from "../services/libraryScanner";
import { extractMediaMetadataForLibrary } from "./movie.controller";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "movies");
const TMP_ROOT = path.join(process.cwd(), "storage", "tmp");

if (!fs.existsSync(TMP_ROOT)) {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
}

interface ActiveUpload {
  id: string;
  userId: string;
  originalFilename: string;
  fileSize: number;
  tempPath: string;
  hash: crypto.Hash;
}

const activeUploads = new Map<string, ActiveUpload>();

export async function getLibraryController(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const library = await getUserLibrary(userId);
  return res.json(library.filter(m => !m.ignored));
}

export async function refreshLibraryController(req: Request, res: Response) {
  const userId = req.params.userId as string;
  
  try {
    await scanUserLibrary(userId);
    const library = await getUserLibrary(userId);
    return res.json({ success: true, library: library.filter(m => !m.ignored) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to refresh library" });
  }
}

export async function initUploadController(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const { filename, size } = req.body;

  if (!filename || !size) {
    return res.status(400).json({ message: "Filename and size are required" });
  }

  const userDir = path.join(STORAGE_ROOT, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const uploadId = randomUUID();
  const tempPath = path.join(TMP_ROOT, uploadId);

  // Clear previous incomplete uploads if any, simple cleanup
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  const activeUpload: ActiveUpload = {
    id: uploadId,
    userId,
    originalFilename: filename,
    fileSize: size,
    tempPath,
    hash: crypto.createHash('sha256')
  };

  activeUploads.set(uploadId, activeUpload);

  return res.json({ success: true, uploadId });
}

export async function uploadChunkController(req: Request, res: Response) {
  const uploadId = req.params.uploadId as string;
  const upload = activeUploads.get(uploadId);

  if (!upload) {
    return res.status(404).json({ message: "Upload session not found" });
  }

  try {
    // req.body contains the raw binary chunk because we use express.raw() in routes
    const chunk = req.body;
    if (!chunk || chunk.length === 0) {
      return res.status(400).json({ message: "Empty chunk" });
    }

    fs.appendFileSync(upload.tempPath, chunk);
    upload.hash.update(chunk);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Chunk upload error:", err);
    return res.status(500).json({ message: "Failed to process chunk" });
  }
}

export async function completeUploadController(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const uploadId = req.params.uploadId as string;
  const upload = activeUploads.get(uploadId);

  if (!upload) {
    return res.status(404).json({ message: "Upload session not found" });
  }

  try {
    const finalHash = upload.hash.digest("hex");
    
    // Check duplicates
    const existing = await findMovieByHash(userId, finalHash);
    if (existing) {
      fs.unlinkSync(upload.tempPath);
      activeUploads.delete(uploadId);
      return res.status(409).json({ message: "This movie already exists in your library" });
    }

    const ext = path.extname(upload.originalFilename);
    const finalFilename = `${uploadId}${ext}`;
    const finalPath = path.join(STORAGE_ROOT, userId, finalFilename);

    fs.renameSync(upload.tempPath, finalPath);
    activeUploads.delete(uploadId);

    const newRecord: LibraryRecord = {
      id: randomUUID(),
      userId,
      movieName: path.parse(upload.originalFilename).name,
      originalFilename: upload.originalFilename,
      size: upload.fileSize,
      mimeType: `video/${ext.replace(".", "")}`, // fallback
      moviePath: finalPath,
      audioTracks: [],
      subtitleTracks: [],
      uploadedAt: new Date().toISOString(),
      ignored: false,
      hash: finalHash,
      status: "processing"
    };

    await addMovieToLibrary(newRecord);

    // Asynchronously process metadata to avoid blocking the response
    (async () => {
      try {
        console.log(`[FFmpeg] Starting async metadata extraction for ${finalPath}`);
        const { audioTracks, subtitleTracks } = await extractMediaMetadataForLibrary(finalPath);
        await updateLibraryRecordStatus(newRecord.id, {
          audioTracks,
          subtitleTracks,
          status: "ready"
        });
        console.log(`[FFmpeg] Finished async extraction for ${finalPath}`);
      } catch (err) {
        console.error(`[FFmpeg] Error extracting metadata async:`, err);
        // Even if extraction fails, it's playable, just maybe lacking tracks
        await updateLibraryRecordStatus(newRecord.id, { status: "ready" });
      }
    })();

    return res.json({ success: true, movie: newRecord });
  } catch (err) {
    console.error("Complete upload error:", err);
    if (fs.existsSync(upload.tempPath)) fs.unlinkSync(upload.tempPath);
    activeUploads.delete(uploadId);
    return res.status(500).json({ message: "Failed to finalize upload" });
  }
}

export async function deleteFromLibraryController(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const id = req.params.id as string;
  const permanent = req.query.permanent === "true";
  
  if (!permanent) {
    const ignored = await ignoreMovieFromLibrary(id, userId);
    if (!ignored) return res.status(404).json({ message: "Movie not found" });
    return res.json({ success: true, deletedId: id, permanent: false });
  }

  // Permanent Delete
  const deleted = await deleteMovieFromLibrary(id, userId);
  
  if (!deleted) {
    return res.status(404).json({ message: "Movie not found" });
  }

  try {
    if (fs.existsSync(deleted.moviePath)) {
      fs.unlinkSync(deleted.moviePath);
    }
    // Delete associated thumbnail and cached poster
    const thumbPath = `${deleted.moviePath}_thumb.jpg`;
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
    const posterPath = `${deleted.moviePath}_poster.jpg`;
    if (fs.existsSync(posterPath)) {
      fs.unlinkSync(posterPath);
    }
    // Delete associated subtitles
    for (const track of deleted.subtitleTracks || []) {
      const vttPath = `${deleted.moviePath}_track_${track.index}.vtt`;
      if (fs.existsSync(vttPath)) {
        fs.unlinkSync(vttPath);
      }
    }
  } catch (err) {
    console.error("Error deleting movie files:", err);
  }

  return res.json({ success: true, deletedId: id, permanent: true });
}

export async function renameLibraryMovieController(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const id = req.params.id as string;
  const { movieName } = req.body;

  if (!movieName) {
    return res.status(400).json({ message: "Movie name is required" });
  }

  const updated = await renameMovieInLibrary(id, userId, movieName);
  if (!updated) {
    return res.status(404).json({ message: "Movie not found" });
  }

  return res.json({ success: true, movie: updated });
}
