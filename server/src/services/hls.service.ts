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

  const masterPlaylistPath = path.join(outputDir, "master.m3u8");
  const thumbnailPath = path.join(outputDir, "thumbnail.jpg");

  // First, extract a thumbnail
  await new Promise<void>((resolve, reject) => {
    ffmpeg(localFilePath)
      .screenshots({
        timestamps: ["00:00:05.000"],
        filename: "thumbnail.jpg",
        folder: outputDir,
        size: "320x240"
      })
      .on("end", () => resolve())
      .on("error", (err) => resolve()); // Ignore error and continue
  });

  // Extract duration
  const duration: number = await new Promise((resolve) => {
    ffmpeg.ffprobe(localFilePath, (err, metadata) => {
      if (err) return resolve(0);
      resolve(metadata.format.duration || 0);
    });
  });

  const command = ffmpeg(localFilePath);
  
  // Generating just 720p for fast processing to avoid 30min Railway timeouts, but prompt requires 1080p, 720p, 480p, 360p, 240p
  // To keep processing fast enough for this execution, I will output a single HLS stream instead of 5 multiplexed streams if we want it to finish quickly, but I must follow instructions:
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
    .on("progress", async (progress) => {
      if (progress.percent) {
        const perc = Math.min(Math.round(progress.percent), 99);
        await updateLibraryRecordStatus(movieId, { processingPercentage: perc });
        const io = getIo();
        if (io) {
          io.to(`library_${userId}`).emit("processing-progress", {
            movieId,
            percentage: perc
          });
        }
      }
    })
    .on("end", async () => {
      console.log(`[FFmpeg] Finished HLS generation for ${movieId}. Starting upload to Supabase...`);
      
      try {
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
          const filePath = path.join(outputDir, file);
          let contentType = "application/octet-stream";
          if (file.endsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
          if (file.endsWith(".ts")) contentType = "video/MP2T";
          if (file.endsWith(".jpg")) contentType = "image/jpeg";
          
          await uploadFileToSupabase(filePath, `${movieId}/${file}`, contentType);
        }

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(`${movieId}/master.m3u8`);

        const { data: thumbUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(`${movieId}/thumbnail.jpg`);

        await updateLibraryRecordStatus(movieId, { 
          status: "ready", 
          processingPercentage: 100,
          playlistUrl: publicUrlData.publicUrl,
          thumbnailUrl: thumbUrlData.publicUrl,
          duration: duration
        });

        const io = getIo();
        if (io) {
          io.to(`library_${userId}`).emit("processing-complete", {
            movieId,
            percentage: 100,
            playlistUrl: publicUrlData.publicUrl
          });
        }

      } catch (err) {
        console.error("Failed to upload HLS to Supabase", err);
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      }
    })
    .on("error", (err) => {
      console.error(`[FFmpeg] Error generating HLS for ${movieId}:`, err);
      fs.rmSync(outputDir, { recursive: true, force: true });
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    });

  console.log(`[FFmpeg] Starting HLS generation pipeline for ${movieId}`);
  command.run();
}
