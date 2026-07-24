export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: Date;
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
  movieName?: string;
  movieSize?: number;
  mimeType?: string;
  duration?: number;
  thumbnail?: string;

  // Participants
  participants: Participant[];

  // Shared Player State
  player: PlayerState;

  // Metadata
  createdAt: Date;
}