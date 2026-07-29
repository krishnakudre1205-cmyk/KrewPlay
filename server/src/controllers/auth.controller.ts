import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { 
  findUserByUsername, 
  saveUser, 
  getUserHistory, 
  clearUserHistory,
  findUserById,
  updateUserAvatar,
  UserRecord
} from "../utils/db";
import { createRoom, getRoom } from "../services/room.service";
// Removed extractMediaMetadata import
import path from "path";
import fs from "fs";

export async function registerController(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    const newUser: UserRecord = {
      id: randomUUID(),
      username,
      password,
    };

    await saveUser(newUser);

    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        avatar: newUser.avatar,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Internal server error during registration" });
  }
}

export async function loginController(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const user = await findUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error during login" });
  }
}

export async function getHistoryController(req: Request, res: Response) {
  const { userId } = req.params;

  try {
    const history = await getUserHistory(userId as string);
    return res.json({
      success: true,
      history,
    });
  } catch (err) {
    console.error("Get history error:", err);
    return res.status(500).json({ message: "Internal server error fetching history" });
  }
}

export async function clearHistoryController(req: Request, res: Response) {
  const { userId } = req.params;
  try {
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    await clearUserHistory(userId as string);
    return res.json({
      success: true,
      message: "History cleared successfully",
      history: [],
    });
  } catch (err) {
    console.error("Clear history error:", err);
    return res.status(500).json({ message: "Internal server error clearing history" });
  }
}

export async function recreateRoomController(req: Request, res: Response) {
  const { userId, movieName, filename } = req.body;

  if (!userId || !movieName || !filename) {
    return res.status(400).json({ message: "userId, movieName, and filename are required" });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const baseUploadDir = process.env.VERCEL
      ? path.join("/tmp", "uploads", "movies")
      : path.join(process.cwd(), "uploads", "movies");
    const moviePath = path.join(baseUploadDir, filename);

    if (!fs.existsSync(moviePath)) {
      return res.status(404).json({
        message: "The movie file has been cleaned or deleted from the server.",
      });
    }

    // Create a new room using user's username
    const room = createRoom(user.username);
    
    // Set the movie properties
    room.moviePath = moviePath;
    room.movieName = movieName;
    room.movieSize = fs.statSync(moviePath).size;
    
    // Set mimeType based on extension
    const ext = path.extname(movieName).toLowerCase();
    if (ext === ".mkv") room.mimeType = "video/x-matroska";
    else if (ext === ".webm") room.mimeType = "video/webm";
    else if (ext === ".avi") room.mimeType = "video/x-msvideo";
    else room.mimeType = "video/mp4";

    // Subtitles & audio tracks metadata extraction removed

    return res.json({
      success: true,
      roomCode: room.code,
      participantId: room.hostId
    });
  } catch (err) {
    console.error("Recreate room error:", err);
    return res.status(500).json({ message: "Internal server error recreating watch session" });
  }
}

export async function getAchievementsController(req: Request, res: Response) {
  const { userId } = req.params;

  try {
    const history = await getUserHistory(userId as string);

    // Compute basic stats
    const totalWatched = history.length;
    const totalHosted = history.filter(h => h.isHost === true).length;
    
    // Co-watchers computation
    const uniqueFriends = new Set<string>();
    let maxCoWatchers = 0;
    const friendWatchesCount: { [friend: string]: number } = {};

    history.forEach(h => {
      if (h.coWatchers) {
        if (h.coWatchers.length > maxCoWatchers) {
          maxCoWatchers = h.coWatchers.length;
        }
        h.coWatchers.forEach(name => {
          uniqueFriends.add(name);
          friendWatchesCount[name] = (friendWatchesCount[name] || 0) + 1;
        });
      }
    });

    const totalUniqueFriends = uniqueFriends.size;
    let maxWatchesWithSameFriend = 0;
    Object.values(friendWatchesCount).forEach(c => {
      if (c > maxWatchesWithSameFriend) maxWatchesWithSameFriend = c;
    });

    // Streaks calculation per friend
    const oneDay = 24 * 60 * 60 * 1000;
    const todayStr = new Date().toISOString().substring(0, 10);
    const yesterday = new Date(Date.now() - oneDay);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    const friendStreaks: { name: string; currentStreak: number; maxStreak: number; watches: number }[] = [];
    let overallMaxStreak = 0;

    uniqueFriends.forEach(friendName => {
      const watchesWithFriend = history.filter(h => h.coWatchers && h.coWatchers.includes(friendName));
      const streakCount = watchesWithFriend.length; // No expiry, increments every watch together like Snapchat

      if (streakCount > 0) {
        if (streakCount > overallMaxStreak) {
          overallMaxStreak = streakCount;
        }

        friendStreaks.push({
          name: friendName,
          currentStreak: streakCount,
          maxStreak: streakCount,
          watches: streakCount,
        });
      }
    });

    // Sort friend streaks descending by currentStreak
    friendStreaks.sort((a, b) => b.currentStreak - a.currentStreak);

    // Build the badges array
    const badges = [
      {
        id: "rookie",
        name: "Popcorn Rookie",
        description: "Watch your first movie",
        icon: "🍿",
        progress: Math.min(totalWatched, 1),
        maxProgress: 1,
        unlocked: totalWatched >= 1,
      },
      {
        id: "buff",
        name: "Cinema Buff",
        description: "Watch 5 movies in KrewPlay",
        icon: "🎥",
        progress: Math.min(totalWatched, 5),
        maxProgress: 5,
        unlocked: totalWatched >= 5,
      },
      {
        id: "legend",
        name: "Cinephile Legend",
        description: "Watch 15 movies in KrewPlay",
        icon: "🏆",
        progress: Math.min(totalWatched, 15),
        maxProgress: 15,
        unlocked: totalWatched >= 15,
      },
      {
        id: "director",
        name: "Director's Cut",
        description: "Host 3 movie watch rooms",
        icon: "🎬",
        progress: Math.min(totalHosted, 3),
        maxProgress: 3,
        unlocked: totalHosted >= 3,
      },
      {
        id: "monarch",
        name: "Party Monarch",
        description: "Host 8 movie watch rooms",
        icon: "👑",
        progress: Math.min(totalHosted, 8),
        maxProgress: 8,
        unlocked: totalHosted >= 8,
      },
      {
        id: "social",
        name: "Social Butterfly",
        description: "Watch movies with 3 unique friends",
        icon: "🤝",
        progress: Math.min(totalUniqueFriends, 3),
        maxProgress: 3,
        unlocked: totalUniqueFriends >= 3,
      },
      {
        id: "crowd",
        name: "Crowd Pleaser",
        description: "Watch a movie with 4 or more co-watchers present",
        icon: "👥",
        progress: Math.min(maxCoWatchers, 4),
        maxProgress: 4,
        unlocked: maxCoWatchers >= 4,
      },
      {
        id: "duo",
        name: "Dynamic Duo",
        description: "Complete 5 watch parties with the same friend",
        icon: "🔥",
        progress: Math.min(maxWatchesWithSameFriend, 5),
        maxProgress: 5,
        unlocked: maxWatchesWithSameFriend >= 5,
      },
      {
        id: "starter",
        name: "Streak Starter",
        description: "Achieve a 2-day watch streak with any friend",
        icon: "⚡",
        progress: Math.min(overallMaxStreak, 2),
        maxProgress: 2,
        unlocked: overallMaxStreak >= 2,
      },
      {
        id: "master",
        name: "Streak Master",
        description: "Achieve a 5-day watch streak with any friend",
        icon: "🌟",
        progress: Math.min(overallMaxStreak, 5),
        maxProgress: 5,
        unlocked: overallMaxStreak >= 5,
      },
    ];

    return res.json({
      success: true,
      stats: {
        totalWatched,
        totalHosted,
        totalUniqueFriends,
        maxCoWatchers,
        overallMaxStreak,
      },
      badges,
      friendStreaks,
    });
  } catch (err) {
    console.error("Get achievements error:", err);
    return res.status(500).json({ message: "Internal server error fetching achievements" });
  }
}

export async function saveAvatarController(req: Request, res: Response) {
  const { userId, avatar } = req.body;

  if (!userId || !avatar || !avatar.emoji || !avatar.gradient) {
    return res.status(400).json({ message: "userId and complete avatar object are required" });
  }

  try {
    const user = await updateUserAvatar(userId, avatar);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Save avatar error:", err);
    return res.status(500).json({ message: "Internal server error saving avatar selection" });
  }
}
