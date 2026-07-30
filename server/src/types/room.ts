export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  joinedAt: Date;
  userId?: string;
  avatar?: {
    emoji: string;
    gradient: string;
  };
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  lastUpdated: number;
}

export interface Room {
  code: string;
  hostId: string;

  // Movie
  moviePath?: string;
  movieUrl?: string;
  playlistUrl?: string;
  movieName?: string;
  movieSize?: number;
  mimeType?: string;
  duration?: number;
  thumbnail?: string;
  thumbnailUrl?: string;

  // Participants
  participants: Participant[];

  // Shared Player State
  player: PlayerState;

  // Audio & Subtitles Info
  audioTracks?: { index: number; language?: string; title?: string; codec?: string }[];
  subtitleTracks?: { index: number; language?: string; title?: string; codec?: string }[];
  selectedAudioTrackIndex?: number;

  // Lock State
  locked?: boolean;
  lockedBy?: string;

  // Visual Theme
  theme?: string;

  // Metadata
  createdAt: Date;
}