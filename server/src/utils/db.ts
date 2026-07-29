import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "data")
  : path.join(__dirname, "../data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export type UserRecord = {
  id: string;
  username: string;
  password?: string; // plain text is fine for this demo/local app
  avatar?: {
    emoji: string;
    gradient: string;
  };
};

export type HistoryRecord = {
  id: string;
  userId: string;
  movieName: string;
  filename: string;
  watchedAt: string;
  isHost?: boolean;
  coWatchers?: string[];
};

export type LibraryRecord = {
  id: string;
  userId: string;
  movieName: string;
  originalFilename: string;
  size: number;
  mimeType: string;
  moviePath: string;
  audioTracks: any[];
  subtitleTracks: any[];
  uploadedAt: string;
  ignored?: boolean;
  hash?: string;
  status?: "processing" | "ready";
  playlistUrl?: string;
  thumbnailUrl?: string;
  processingPercentage?: number;
  duration?: number;
};

export type ContinueWatchingRecord = {
  id: string;
  userId: string;
  movieId: string; // library ID, youtube ID, or URL hash
  movieTitle: string;
  poster?: string;
  duration: number;
  currentPosition: number;
  progressPercentage?: number;
  timestamp: number;
  lastRoomCode?: string;
  isHost: boolean;
  completed?: boolean;
};

type DbSchema = {
  users: UserRecord[];
  history: HistoryRecord[];
  library: LibraryRecord[];
  continueWatching: ContinueWatchingRecord[];
};

function ensureDbExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData: DbSchema = {
      users: [],
      history: [],
      library: [],
      continueWatching: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf8");
  }
}

async function readDb(): Promise<DbSchema> {
  ensureDbExists();
  try {
    const content = await fs.promises.readFile(DB_FILE, "utf8");
    const db = JSON.parse(content) as DbSchema;
    if (!db.library) db.library = [];
    if (!db.history) db.history = [];
    if (!db.users) db.users = [];
    if (!db.continueWatching) db.continueWatching = [];
    return db;
  } catch (err) {
    console.error("Error reading database file, returning default structure", err);
    return { users: [], history: [], library: [], continueWatching: [] };
  }
}

async function writeDb(data: DbSchema): Promise<void> {
  ensureDbExists();
  try {
    await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to database file", err);
  }
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const db = await readDb();
  return db.users;
}

export async function findUserByUsername(username: string): Promise<UserRecord | undefined> {
  const db = await readDb();
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

export async function findUserById(id: string): Promise<UserRecord | undefined> {
  const db = await readDb();
  return db.users.find(u => u.id === id);
}

export async function saveUser(user: UserRecord): Promise<void> {
  const db = await readDb();
  db.users.push(user);
  await writeDb(db);
}

export async function getUserHistory(userId: string): Promise<HistoryRecord[]> {
  const db = await readDb();
  // Filter history entries for this user, sorted by watchedAt descending
  return db.history
    .filter(h => h.userId === userId)
    .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
}

export async function saveHistory(entry: HistoryRecord): Promise<void> {
  const db = await readDb();
  // Avoid duplicate entries of the same movie for the same user on the same day if desired,
  // but to keep it simple, we check if the exact same filename has been watched recently.
  const isDuplicate = db.history.some(
    h => h.userId === entry.userId && h.filename === entry.filename && h.movieName === entry.movieName
  );

  if (!isDuplicate) {
    db.history.push(entry);
    await writeDb(db);
  }
}

export async function clearUserHistory(userId: string): Promise<void> {
  const db = await readDb();
  db.history = db.history.filter(h => h.userId !== userId);
  await writeDb(db);
}

export async function updateUserAvatar(
  userId: string, 
  avatar: { emoji: string; gradient: string }
): Promise<UserRecord | undefined> {
  const db = await readDb();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.avatar = avatar;
    await writeDb(db);
    return user;
  }
  return undefined;
}

export async function getUserLibrary(userId: string): Promise<LibraryRecord[]> {
  const db = await readDb();
  return db.library
    .filter(lib => lib.userId === userId)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function addMovieToLibrary(record: LibraryRecord): Promise<void> {
  const db = await readDb();
  db.library.push(record);
  await writeDb(db);
}

export async function deleteMovieFromLibrary(id: string, userId: string): Promise<LibraryRecord | undefined> {
  const db = await readDb();
  const index = db.library.findIndex(lib => lib.id === id && lib.userId === userId);
  if (index !== -1) {
    const deleted = db.library.splice(index, 1)[0];
    await writeDb(db);
    return deleted;
  }
  return undefined;
}

export async function ignoreMovieFromLibrary(id: string, userId: string): Promise<LibraryRecord | undefined> {
  const db = await readDb();
  const record = db.library.find(lib => lib.id === id && lib.userId === userId);
  if (record) {
    record.ignored = true;
    await writeDb(db);
    return record;
  }
  return undefined;
}

export async function renameMovieInLibrary(id: string, userId: string, newName: string): Promise<LibraryRecord | undefined> {
  const db = await readDb();
  const record = db.library.find(lib => lib.id === id && lib.userId === userId);
  if (record) {
    record.movieName = newName;
    await writeDb(db);
    return record;
  }
  return undefined;
}

export async function getMovieFromLibrary(id: string): Promise<LibraryRecord | undefined> {
  const db = await readDb();
  return db.library.find(lib => lib.id === id);
}

export async function findMovieByHash(userId: string, hash: string): Promise<LibraryRecord | undefined> {
  const db = await readDb();
  return db.library.find(lib => lib.userId === userId && lib.hash === hash && !lib.ignored);
}

export async function updateLibraryRecordStatus(id: string, updates: Partial<LibraryRecord>): Promise<LibraryRecord | undefined> {
  const db = await readDb();
  const record = db.library.find(lib => lib.id === id);
  if (record) {
    Object.assign(record, updates);
    await writeDb(db);
    return record;
  }
  return undefined;
}

export async function getContinueWatchingList(userId: string): Promise<ContinueWatchingRecord[]> {
  const db = await readDb();
  return db.continueWatching
    .filter(record => record.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function saveContinueWatching(record: Omit<ContinueWatchingRecord, "id" | "timestamp">): Promise<ContinueWatchingRecord> {
  const db = await readDb();
  
  let existingIndex = db.continueWatching.findIndex(
    r => r.userId === record.userId && r.movieId === record.movieId
  );
  
  const now = Date.now();
  const progressPercentage = record.duration > 0 ? (record.currentPosition / record.duration) * 100 : 0;
  const completed = progressPercentage >= 95;
  
  let finalRecord: ContinueWatchingRecord;
  
  if (existingIndex !== -1) {
    finalRecord = {
      ...db.continueWatching[existingIndex],
      ...record,
      progressPercentage,
      completed,
      timestamp: now,
    };
    db.continueWatching[existingIndex] = finalRecord;
  } else {
    finalRecord = {
      ...record,
      id: randomUUID(),
      progressPercentage,
      completed,
      timestamp: now,
    };
    db.continueWatching.push(finalRecord);
  }
  
  await writeDb(db);
  return finalRecord;
}

export async function deleteContinueWatching(userId: string, id: string): Promise<boolean> {
  const db = await readDb();
  const initialLength = db.continueWatching.length;
  db.continueWatching = db.continueWatching.filter(r => !(r.userId === userId && r.id === id));
  
  if (db.continueWatching.length !== initialLength) {
    await writeDb(db);
    return true;
  }
  return false;
}
