import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { supabase } from "./supabase";
import { getIo } from "../sockets"; 
import { updateLibraryRecordStatus } from "../utils/db";

const BUCKET_NAME = "movies";

async function uploadFileToSupabase(localPath: string, remotePath: string, contentType: string) {
  const fileBuffer = fs.readFileSync(localPath);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(remotePath, fileBuffer, {
      contentType,
      upsert: true,
    });
  
  if (error) {
    throw new Error(`Failed to upload ${remotePath}: ${error.message}`);
  }
  return data;
}

export async function processHLSAndUpload(
  movieId: string,
  localFilePath: string,
  userId: string
) {
  const outputDir = path.join(process.cwd(), "storage", "tmp", movieId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const io = getIo();
  const emitProgress = (percentage: number) => {
    if (io) io.to(`library_${userId}`).emit("processing-progress", { movieId, percentage });
  };
  const emitComplete = (playlistUrl: string) => {
    if (io) io.to(`library_${userId}`).emit("processing-complete", { movieId, playlistUrl });
  };

  emitProgress(5); // Reading Video Information

  // 1. Extract thumbnail
  await new Promise<void>((resolve) => {
    ffmpeg(localFilePath)
      .screenshots({
        timestamps: ["00:00:05.000"],
        filename: "thumbnail.jpg",
        folder: outputDir,
        size: "320x240"
      })
      .on("end", () => resolve())
      .on("error", () => resolve());
  });

  // 2. Extract metadata
  const metadata: any = await new Promise((resolve) => {
    ffmpeg.ffprobe(localFilePath, (err, metadata) => {
      if (err) return resolve({ duration: 0, size: 0 });
      resolve({
        duration: metadata.format.duration || 0,
        size: metadata.format.size || 0
      });
    });
  });

  const duration = metadata.duration;
  const sizeMB = metadata.size / (1024 * 1024);
  const isSmall = sizeMB < 100;
  
  emitProgress(20); // Preparing Movie

  let finalUrl = "";

  if (isSmall) {
    console.log(`[FFmpeg] Small file detected (${sizeMB.toFixed(2)}MB). Using fast-path direct upload.`);
    // Fast path: upload original mp4 directly
    const remotePath = `${movieId}/original.mp4`;
    await uploadFileToSupabase(localFilePath, remotePath, "video/mp4");
    
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(remotePath);
      
    finalUrl = publicUrlData.publicUrl;
  } else {
    console.log(`[FFmpeg] Large file detected (${sizeMB.toFixed(2)}MB). Generating 720p fast-path HLS.`);
    // Fast path: generate single 720p stream
    await new Promise<void>((resolve, reject) => {
      ffmpeg(localFilePath)
        .outputOptions([
          "-map 0:v:0",
          "-map 0:a:0?",
          "-c:v libx264",
          "-b:v 2800k",
          "-c:a aac",
          "-b:a 128k",
          "-filter:v scale=1280:720",
          "-f hls",
          "-hls_time 6",
          "-hls_playlist_type vod",
          "-hls_segment_filename", path.join(outputDir, "fast_stream_%03d.ts")
        ])
        .output(path.join(outputDir, "fast_stream.m3u8"))
        .on("progress", (progress) => {
          if (progress.percent) emitProgress(20 + Math.round(progress.percent * 0.7));
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Upload fast stream files
    const files = fs.readdirSync(outputDir).filter(f => f.includes("fast_stream"));
    for (const file of files) {
      let contentType = "application/octet-stream";
      if (file.endsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
      if (file.endsWith(".ts")) contentType = "video/MP2T";
      await uploadFileToSupabase(path.join(outputDir, file), `${movieId}/${file}`, contentType);
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`${movieId}/fast_stream.m3u8`);
    
    finalUrl = publicUrlData.publicUrl;
  }

  // Upload thumbnail
  await uploadFileToSupabase(path.join(outputDir, "thumbnail.jpg"), `${movieId}/thumbnail.jpg`, "image/jpeg");
  const { data: thumbUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${movieId}/thumbnail.jpg`);

  // Update DB and emit ready
  await updateLibraryRecordStatus(movieId, {
    status: "ready",
    processingPercentage: 100,
    playlistUrl: finalUrl,
    thumbnailUrl: thumbUrlData.publicUrl,
    duration: duration,
    optimizationStatus: "optimizing"
  });

  emitComplete(finalUrl);
  console.log(`[FFmpeg] Fast-path complete for ${movieId}. Movie is playable.`);

  // PHASE 2: Background Optimization (Generate full adaptive HLS)
  runBackgroundOptimization(movieId, localFilePath, userId, outputDir).catch(err => {
    console.error(`[Background] Optimization failed for ${movieId}:`, err);
  });
}

async function runBackgroundOptimization(movieId: string, localFilePath: string, userId: string, outputDir: string) {
  console.log(`[Background] Starting full adaptive HLS optimization for ${movieId}`);
  const io = getIo();
  const emitOptimizing = (percentage: number) => {
    if (io) io.to(`library_${userId}`).emit("optimizing-progress", { movieId, percentage });
  };

  const command = ffmpeg(localFilePath);
  
  const resolutions = [
    { name: "1080p", scale: "1920:1080", bitrate: "5000k" },
    { name: "720p", scale: "1280:720", bitrate: "2800k" },
    { name: "480p", scale: "854:480", bitrate: "1400k" },
    { name: "360p", scale: "640:360", bitrate: "800k" },
    { name: "240p", scale: "426:240", bitrate: "400k" },
  ];

  resolutions.forEach((res, index) => {
    command
      .outputOptions([
        `-map 0:v:0`,
        `-map 0:a:0?`,
        `-c:v:${index} libx264`,
        `-b:v:${index} ${res.bitrate}`,
        `-c:a:${index} aac`,
        `-b:a:${index} 128k`,
        `-filter:v:${index} scale=${res.scale}`,
      ]);
  });

  await new Promise<void>((resolve, reject) => {
    command
      .outputOptions([
        "-f hls",
        "-hls_time 6", 
        "-hls_playlist_type vod",
        "-hls_segment_filename", path.join(outputDir, "v%v_stream_%03d.ts"),
        "-master_pl_name master.m3u8",
        `-var_stream_map`, `v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3 v:4,a:4` 
      ])
      .output(path.join(outputDir, "v%v_stream.m3u8"))
      .on("progress", (progress) => {
        if (progress.percent) {
          emitOptimizing(Math.min(Math.round(progress.percent), 99));
        }
      })
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });

  // Upload optimized files
  const files = fs.readdirSync(outputDir).filter(f => !f.includes("fast_stream") && !f.includes("thumbnail"));
  for (const file of files) {
    let contentType = "application/octet-stream";
    if (file.endsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
    if (file.endsWith(".ts")) contentType = "video/MP2T";
    await uploadFileToSupabase(path.join(outputDir, file), `${movieId}/${file}`, contentType);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${movieId}/master.m3u8`);

  // Update DB to optimized playlist
  await updateLibraryRecordStatus(movieId, {
    playlistUrl: publicUrlData.publicUrl,
    optimizationStatus: "completed"
  });

  if (io) io.to(`library_${userId}`).emit("optimizing-progress", { movieId, percentage: 100 });
  
  console.log(`[Background] Full optimization complete for ${movieId}`);
  
  // Clean up
  fs.rmSync(outputDir, { recursive: true, force: true });
  if (fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
  }
}

