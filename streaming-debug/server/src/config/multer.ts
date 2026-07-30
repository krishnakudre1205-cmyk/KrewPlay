import multer from "multer";
import path from "path";
import fs from "fs";

const uploadPath = path.join(process.cwd(), "uploads", "movies");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },

  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  },
});

export const upload = multer({
  storage,

  fileFilter: (_req, file, cb) => {
    const allowed = [
      ".mp4",
      ".mkv",
      ".webm",
      ".avi",
    ];

    const ext = path.extname(file.originalname).toLowerCase();

    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported movie format"));
    }
  },
});