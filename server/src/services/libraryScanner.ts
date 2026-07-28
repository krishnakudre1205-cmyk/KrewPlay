import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getAllUsers, getUserLibrary, addMovieToLibrary, deleteMovieFromLibrary, LibraryRecord } from "../utils/db";
import { extractMediaMetadataForLibrary } from "../controllers/movie.controller";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "movies");

const SUPPORTED_EXTENSIONS = [".mp4", ".mkv", ".avi", ".mov", ".webm"];

export async function scanUserLibrary(userId: string): Promise<void> {
  const userDir = path.join(STORAGE_ROOT, userId);
  
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const existingLibrary = await getUserLibrary(userId);
  const physicalFiles = new Set<string>();

  try {
    const files = fs.readdirSync(userDir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

      const fullPath = path.join(userDir, file);
      physicalFiles.add(fullPath);

      const stat = fs.statSync(fullPath);
      
      // Check if file is already in library (by exact path)
      const existingRecord = existingLibrary.find(r => r.moviePath === fullPath);
      
      if (existingRecord) {
        // If it's explicitly ignored by the user via UI, we don't re-add it or change it, but it stays in DB as ignored.
        // If we want to skip processing, just continue.
        continue;
      }

      console.log(`[Scanner] Found new movie for user ${userId}: ${file}`);

      try {
        const { audioTracks, subtitleTracks } = await extractMediaMetadataForLibrary(fullPath);

        const newRecord: LibraryRecord = {
          id: randomUUID(),
          userId,
          movieName: path.parse(file).name,
          originalFilename: file,
          size: stat.size,
          mimeType: `video/${ext.replace(".", "")}`, // simple fallback
          moviePath: fullPath,
          audioTracks,
          subtitleTracks,
          uploadedAt: new Date().toISOString(),
          ignored: false
        };

        await addMovieToLibrary(newRecord);
        console.log(`[Scanner] Added ${file} to library.`);
      } catch (err) {
        console.error(`[Scanner] Failed to process metadata for ${file}:`, err);
      }
    }

    // Now check for files that exist in the DB but were removed physically from the folder
    for (const record of existingLibrary) {
      if (!physicalFiles.has(record.moviePath)) {
        console.log(`[Scanner] Removing missing file from DB: ${record.movieName}`);
        await deleteMovieFromLibrary(record.id, userId);
      }
    }

  } catch (err) {
    console.error(`[Scanner] Error scanning directory for user ${userId}:`, err);
  }
}

export async function scanAllLibraries(): Promise<void> {
  console.log("[Scanner] Starting background library scan for all users...");
  try {
    const users = await getAllUsers();
    for (const user of users) {
      // Intentionally awaiting to avoid parallel FFmpeg spikes during startup
      await scanUserLibrary(user.id);
    }
    console.log("[Scanner] Background library scan completed.");
  } catch (err) {
    console.error("[Scanner] Error during global scan:", err);
  }
}
