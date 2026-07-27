import fs from "fs";
import path from "path";

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

type DbSchema = {
  users: UserRecord[];
  history: HistoryRecord[];
};

function ensureDbExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData: DbSchema = {
      users: [],
      history: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf8");
  }
}

async function readDb(): Promise<DbSchema> {
  ensureDbExists();
  try {
    const content = await fs.promises.readFile(DB_FILE, "utf8");
    return JSON.parse(content) as DbSchema;
  } catch (err) {
    console.error("Error reading database file, returning default structure", err);
    return { users: [], history: [] };
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
