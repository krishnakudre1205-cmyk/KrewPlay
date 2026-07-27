import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../../services/socket";
import { API_BASE_URL } from "../../config/api";
import {
  joinVoice,
  leaveVoice,
  toggleMute,
} from "../../services/webrtc";
import TopBar from "../../components/room/TopBar";
import { 
  RotateCcw, 
  RotateCw, 
  Mic, 
  MicOff, 
  Users, 
  MessageSquare, 
  Lock, 
  Unlock, 
  Maximize, 
  Tv,
  Send,
  Play,
  Settings,
  Subtitles
} from "lucide-react";

type Participant = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  avatar?: {
    emoji: string;
    gradient: string;
  };
};

type RoomData = {
  code: string;
  participants: Participant[];
  movieName?: string;
  movieUrl?: string;
  audioTracks?: { index: number; language?: string; title?: string; codec?: string }[];
  subtitleTracks?: { index: number; language?: string; title?: string; codec?: string }[];
  selectedAudioTrackIndex?: number;
  player?: {
    isPlaying: boolean;
    currentTime: number;
    playbackRate: number;
    lastUpdated: number;
  };
};

type ChatMessage = {
  participantName: string;
  message: string;
  time: string;
};

function getYouTubeVideoId(url: string | undefined): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function Room() {
  const { id } = useParams();
  const [chatPopup, setChatPopup] = useState<ChatMessage | null>(null);
  
  const QUICK_MESSAGES = [
    "👍 Nice!",
    "😂 LOL",
    "🍿 Ready?",
    "⏸ Pause",
    "▶ Play",
    "⏩ Skip +10",
    "⏪ Back 10",
    "❤️ Amazing!",
    "😱 Wow!",
    "👏 Great!",
    "🤣 Hahaha",
    "🎉 Let's Go!"
  ];

  const REACTIONS = [
    "😂",
    "❤️",
    "🔥",
    "👏",
    "😱",
    "😭",
    "🍿",
    "👍",
    "👎",
    "🎉",
  ];

  const [theatreMode, setTheatreMode] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const popupTimeout = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const lastSync = useRef(0);
  const activityTimeout = useRef<number | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedHost, setSelectedHost] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState("");
  const [speed, setSpeed] = useState(1);
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState<"forward" | "backward" | null>(null);
  const controlsTimeout = useRef<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState("");
  const navigate = useNavigate();
  const [reactions, setReactions] = useState<{ id: number; emoji: string; participantName: string; }[]>([]);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<number | undefined>(undefined);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const countdownTimerRef = useRef<number | null>(null);

  // Derive streamUrl based on selectedAudio track parameter
  const streamUrl = roomData?.movieUrl
    ? roomData.movieUrl
    : selectedAudio !== undefined 
    ? `${API_BASE_URL}/movies/${id}/stream?audioTrack=${selectedAudio}` 
    : `${API_BASE_URL}/movies/${id}/stream`;

  const youtubeId = getYouTubeVideoId(streamUrl);

  const selectSubtitleTrack = (index: number | null) => {
    setSelectedSubtitle(index);
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (index === null) {
        tracks[i].mode = "disabled";
      } else {
        const targetTrack = roomData?.subtitleTracks?.find(t => t.index === index);
        if (targetTrack && (tracks[i].label === targetTrack.title || tracks[i].language === targetTrack.language)) {
          tracks[i].mode = "showing";
        } else {
          tracks[i].mode = "disabled";
        }
      }
    }
  };

  function handleLoadedMetadata() {
    if (!videoRef.current) return;
    isSyncing.current = true;
    const targetTime = roomData?.player?.currentTime ?? 0;
    videoRef.current.currentTime = targetTime;
    const isPlaying = roomData?.player?.isPlaying ?? false;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
    setTimeout(() => {
      isSyncing.current = false;
    }, 300);
  }

  const runCountdownSequence = async (shouldFullscreen: boolean) => {
    if (shouldFullscreen && playerRef.current && !document.fullscreenElement) {
      try {
        await playerRef.current.requestFullscreen();
      } catch (err) {
        console.warn("Fullscreen permission denied:", err);
      }
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    setCountdown(3);
    let count = 3;
    
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    countdownTimerRef.current = window.setInterval(() => {
      count--;
      if (count <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(null);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      } else {
        setCountdown(count);
      }
    }, 1000);
  };


  function sendQuickMessage(text: string) {
    const participantId = localStorage.getItem("participantId");
    const me = participants.find(p => p.id === participantId);
    if (!me) return;

    socket.emit("send-message", {
      roomCode: id,
      participantName: me.name,
      message: text,
    });
  }

  async function handleLeaveRoom() {
    const participantId = localStorage.getItem("participantId");
    const me = participants.find(p => p.id === participantId);
    const availableHosts = participants.filter(p => p.connected && !p.isHost);

    if (me?.isHost) {
      if (availableHosts.length === 0) {
        leaveRoomNow();
        return;
      }
      setShowTransferDialog(true);
      return;
    }
    leaveRoomNow();
  }

  const leaveRoomRef = useRef(handleLeaveRoom);
  useEffect(() => {
    leaveRoomRef.current = handleLeaveRoom;
  });

  useEffect(() => {
    function handleTriggerLeave() {
      leaveRoomRef.current();
    }
    window.addEventListener("trigger-leave-room", handleTriggerLeave);
    return () => {
      window.removeEventListener("trigger-leave-room", handleTriggerLeave);
    };
  }, []);

  async function leaveRoomNow(newHostId?: string) {
    leaveVoice();
    const participantId = localStorage.getItem("participantId");

    const response = await fetch(`${API_BASE_URL}/rooms/${id}/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participantId,
        newHostId,
      }),
    });

    const result = await response.json();
    socket.emit("leave-room", { roomCode: id });

    if (result.hostTransferred) {
      socket.emit("host-changed", {
        roomCode: id,
        newHost: result.newHost,
      });
    }

    localStorage.removeItem("participantId");
    navigate("/");
  }

  async function loadRoom() {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/${id}`);
      if (!res.ok) return;
      const room: RoomData = await res.json();
      setRoomData(room);
      setParticipants(room.participants);
    } catch (err) {
      console.error(err);
    }
  }

  function handleUserLeft() {
    loadRoom();
  }

  function syncPlayer(action: "play" | "pause" | "seek" | "speed") {
    if (isSyncing.current || !videoRef.current) return;
    if (action === "seek" && Date.now() - lastSync.current < 1000) return;

    lastSync.current = Date.now();
    const participantId = localStorage.getItem("participantId");
    const me = participants.find((p) => p.id === participantId);

    socket.emit("player-sync", {
      roomCode: id,
      participantName: me?.name ?? "Unknown",
      action,
      player: {
        isPlaying: !videoRef.current.paused,
        currentTime: videoRef.current.currentTime,
        playbackRate: videoRef.current.playbackRate,
        lastUpdated: Date.now(),
      },
    });
  }

  function handlePlay() {
    if (locked) return;
    if (isSyncing.current) return;
    syncPlayer("play");
  }

  function handlePause() {
    if (locked) return;
    if (isSyncing.current) return;
    if (videoRef.current?.seeking) return;
    syncPlayer("pause");
  }

  function handleSeek() {
    if (locked) return;
    if (isSyncing.current) return;
    syncPlayer("seek");
  }

  function handleSpeed() {
    if (locked) return;
    if (videoRef.current) {
      setSpeed(videoRef.current.playbackRate);
    }
    syncPlayer("speed");
  }

  function skipVideo(direction: "forward" | "backward") {
    if (locked) return;
    if (!videoRef.current) return;

    const amount = direction === "forward" ? 10 : -10;
    isSyncing.current = true;

    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + amount);

    setTimeout(() => {
      isSyncing.current = false;
    }, 250);

    setSkipAnimation(direction);
    setTimeout(() => setSkipAnimation(null), 800);

    const participantId = localStorage.getItem("participantId");
    const me = participants.find((p) => p.id === participantId);

    socket.emit("player-skip", {
      roomCode: id,
      participantName: me?.name ?? "Unknown",
      direction,
      player: {
        isPlaying: !videoRef.current.paused,
        currentTime: videoRef.current.currentTime,
        playbackRate: videoRef.current.playbackRate,
        lastUpdated: Date.now(),
      },
    });
  }

  function toggleLock() {
    const participantId = localStorage.getItem("participantId");
    const me = participants.find(p => p.id === participantId);
    socket.emit("toggle-lock", {
      roomCode: id,
      participantName: me?.name ?? "Unknown",
    });
  }

  function startCountdown() {
    socket.emit("start-countdown", { roomCode: id });
  }

  function sendReaction(emoji: string) {
    const participantId = localStorage.getItem("participantId");
    const me = participants.find((p) => p.id === participantId);
    if (!me) return;

    socket.emit("reaction", {
      roomCode: id,
      emoji,
      participantName: me.name,
    });
  }

  function sendMessage() {
    if (!message.trim()) return;
    const participantId = localStorage.getItem("participantId");
    const me = participants.find((p) => p.id === participantId);
    if (!me) return;

    socket.emit("send-message", {
      roomCode: id,
      participantName: me.name,
      message,
    });
    setMessage("");
  }

  useEffect(() => {
    const session = localStorage.getItem("user");
    if (!session) {
      navigate("/login");
      return;
    }
    if (!id) return;
    loadRoom();
    joinVoice(id)
      .then(() => setVoiceJoined(true))
      .catch(console.error);

    function handleHostChanged() {
      loadRoom();
    }

    function handleLockState(data: { locked: boolean; lockedBy: string; }) {
      setLocked(data.locked);
      setLockedBy(data.lockedBy);
      setActivity(
        data.locked
          ? `🔒 Controls locked by ${data.lockedBy}`
          : "🔓 Controls unlocked"
      );
    }

    function handleReaction(data: { emoji: string; participantName: string; }) {
      const id = Date.now() + Math.random();
      setReactions((prev) => [
        ...prev,
        { id, emoji: data.emoji, participantName: data.participantName },
      ]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    }

    function handleStartCountdown() {
      runCountdownSequence(true);
    }

    function handleKeyDown(e: KeyboardEvent) {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)
      ) {
        return;
      }

      if (locked && [" ", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (videoRef.current?.paused) {
            videoRef.current.play();
          } else {
            videoRef.current?.pause();
          }
          break;
        case "ArrowLeft":
          skipVideo("backward");
          break;
        case "ArrowRight":
          skipVideo("forward");
          break;
        case "f":
        case "F":
          if (!document.fullscreenElement) {
            playerRef.current?.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
        case "m":
        case "M":
          toggleMute();
          setMuted((prev) => !prev);
          break;
      }
    }

    function handlePlayerSkip(data: {
      participantName: string;
      direction: "forward" | "backward";
      player: { isPlaying: boolean; currentTime: number; playbackRate: number; lastUpdated: number; };
    }) {
      if (!videoRef.current) return;
      isSyncing.current = true;
      const diff = Math.abs(videoRef.current.currentTime - data.player.currentTime);

      if (diff > 0.5) {
        videoRef.current.currentTime = data.player.currentTime;
      }

      videoRef.current.playbackRate = data.player.playbackRate;
      setSpeed(data.player.playbackRate);

      if (data.player.isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }

      setSkipAnimation(data.direction);
      setTimeout(() => setSkipAnimation(null), 800);

      setActivity(
        data.direction === "forward"
          ? `⏩ ${data.participantName} skipped +10s`
          : `⏪ ${data.participantName} skipped -10s`
      );

      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }
      activityTimeout.current = window.setTimeout(() => setActivity(""), 3000);
      setTimeout(() => { isSyncing.current = false; }, 300);
    }

    function handleUserJoined() {
      loadRoom();
    }

    function handleNewMessage(data: ChatMessage) {
      setMessages((prev) => [...prev, data]);
      
      const participantId = localStorage.getItem("participantId");
      const me = participants.find((p) => p.id === participantId);
      
      if (data.participantName !== me?.name) {
        setChatPopup(data);
        if (popupTimeout.current) {
          clearTimeout(popupTimeout.current);
        }
        popupTimeout.current = window.setTimeout(() => setChatPopup(null), 4500);
      }
    }

    function handlePlayerSync(data: {
      participantName: string;
      action: "play" | "pause" | "seek" | "speed";
      player: { isPlaying: boolean; currentTime: number; playbackRate: number; lastUpdated: number; };
    }) {
      if (!videoRef.current) return;
      isSyncing.current = true;

      if (Math.abs(videoRef.current.currentTime - data.player.currentTime) > 0.5) {
        videoRef.current.currentTime = data.player.currentTime;
      }

      videoRef.current.playbackRate = data.player.playbackRate;
      setSpeed(data.player.playbackRate);

      switch (data.action) {
        case "play":
          videoRef.current.play().catch(() => {});
          setActivity(`▶️ ${data.participantName} played`);
          break;
        case "pause":
          videoRef.current.pause();
          setActivity(`⏸️ ${data.participantName} paused`);
          break;
        case "seek":
          setActivity(`⏩ ${data.participantName} skipped`);
          break;
        case "speed":
          setActivity(`⚡ ${data.participantName} changed speed to ${data.player.playbackRate}x`);
          break;
      }

      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }
      activityTimeout.current = window.setTimeout(() => setActivity(""), 3000);
      setTimeout(() => { isSyncing.current = false; }, 150);
    }

    function handlePlayerState(player: { isPlaying: boolean; currentTime: number; playbackRate: number; lastUpdated: number; }) {
      if (!videoRef.current) return;
      videoRef.current.playbackRate = player.playbackRate;
      setSpeed(player.playbackRate);

      if (player.isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      if (!player.isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }

    socket.on("player-sync", handlePlayerSync);
    socket.on("player-state", handlePlayerState);
    socket.on("user-joined", handleUserJoined);
    socket.on("new-message", handleNewMessage);
    socket.on("player-skip", handlePlayerSkip);
    window.addEventListener("keydown", handleKeyDown);
    socket.on("lock-state", handleLockState);
    socket.on("user-left", handleUserLeft);
    socket.on("host-changed", handleHostChanged);
    socket.on("start-countdown", handleStartCountdown);
    socket.on("reaction", handleReaction);

    return () => {
      leaveVoice();
      socket.off("reaction", handleReaction);
      socket.off("start-countdown", handleStartCountdown);
      socket.off("host-changed", handleHostChanged);
      socket.off("user-left", handleUserLeft);
      socket.off("lock-state", handleLockState);
      window.removeEventListener("keydown", handleKeyDown);
      socket.off("user-joined", handleUserJoined);
      socket.off("new-message", handleNewMessage);
      socket.off("player-sync", handlePlayerSync);
      socket.off("player-state", handlePlayerState);
      socket.off("player-skip", handlePlayerSkip);
      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }
    };
  }, [id, navigate]);

  const isMeHost = participants.find(
    p => p.id === localStorage.getItem("participantId")
  )?.isHost;

  return (
    <div className={`min-h-screen text-lavender-100 p-4 md:p-6 lg:p-8 transition-all duration-700 relative z-10 ${theatreMode ? "bg-[#080004]" : "bg-[#14020c]"}`}>
      <TopBar roomCode={id ?? ""} onLeave={handleLeaveRoom} />

      {/* Main Theatre Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto items-start">
        
        {/* Left Side: Video Player */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-burgundy-900/10 border border-burgundy-900/30 rounded-3xl p-4 md:p-6 shadow-2xl relative">
            
            {/* Ambient Background glow backlight */}
            {theatreMode && !youtubeId && (
              <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl opacity-35 scale-[1.02] blur-3xl transition-opacity duration-700 pointer-events-none">
                <video
                  className="w-full h-full object-cover"
                  src={streamUrl}
                  autoPlay
                  muted
                  loop
                />
              </div>
            )}

            {/* Notification/Activity overlay */}
            {activity && (
              <div className="absolute top-6 left-6 z-40 rounded-xl border border-lavender-500/20 bg-burgundy-950/80 backdrop-blur-md px-4 py-2.5 text-xs text-lavender-100 shadow-xl flex items-center gap-2 animate-bounce">
                <span className="h-1.5 w-1.5 rounded-full bg-lavender-400 animate-ping" />
                {activity}
              </div>
            )}

            {/* Lock indicator */}
            {locked && (
              <div className="absolute top-6 right-6 z-40 rounded-xl border border-red-500/20 bg-red-950/80 backdrop-blur-md px-4 py-2.5 text-xs text-red-300 shadow-xl flex items-center gap-2">
                <Lock size={12} className="text-red-400" />
                <span>Locked by {lockedBy}</span>
              </div>
            )}

            {/* Big Video element */}
            <div
              ref={playerRef}
              className={`relative overflow-hidden rounded-2xl bg-black border border-burgundy-900/40 shadow-inner z-20 aspect-video ${theatreMode ? "ring-2 ring-lavender-500/10" : ""}`}
              onMouseMove={() => {
                setShowControls(true);
                if (controlsTimeout.current) {
                  clearTimeout(controlsTimeout.current);
                }
                controlsTimeout.current = window.setTimeout(() => setShowControls(false), 3000);
              }}
              onDoubleClick={(e) => {
                if (locked) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                if (x < rect.width * 0.35) {
                  skipVideo("backward");
                } else if (x > rect.width * 0.65) {
                  skipVideo("forward");
                }
              }}
            >
              {/* Buffering overlay */}
              {buffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs z-30">
                  <div className="relative flex items-center justify-center">
                    <div className="h-14 w-14 animate-spin rounded-full border-4 border-lavender-400/20 border-t-lavender-400" />
                    <span className="absolute text-[10px] uppercase font-bold text-lavender-200 tracking-wider">LOD</span>
                  </div>
                </div>
              )}

              {/* Double tap forward/backward skip visualizers */}
              {skipAnimation === "backward" && (
                <div className="absolute inset-y-0 left-0 flex w-1/3 items-center justify-center pointer-events-none z-30 bg-gradient-to-r from-black/40 to-transparent">
                  <div className="flex flex-col items-center justify-center rounded-full bg-burgundy-950/80 border border-burgundy-800/40 p-5 text-white animate-ping">
                    <RotateCcw size={32} className="text-lavender-300" />
                    <span className="mt-1 text-xs font-bold text-lavender-200">-10s</span>
                  </div>
                </div>
              )}

              {skipAnimation === "forward" && (
                <div className="absolute inset-y-0 right-0 flex w-1/3 items-center justify-center pointer-events-none z-30 bg-gradient-to-l from-black/40 to-transparent">
                  <div className="flex flex-col items-center justify-center rounded-full bg-burgundy-950/80 border border-burgundy-800/40 p-5 text-white animate-ping">
                    <RotateCw size={32} className="text-lavender-300" />
                    <span className="mt-1 text-xs font-bold text-lavender-200">+10s</span>
                  </div>
                </div>
              )}

              {/* Floating Emojis visualizer */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
                {reactions.map((reaction) => (
                  <div
                    key={reaction.id}
                    className="absolute bottom-6 right-8 animate-[floatUp_2.5s_linear_forwards] flex flex-col items-center"
                  >
                    <span className="text-5xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">{reaction.emoji}</span>
                    <span className="text-[10px] bg-burgundy-950/80 border border-burgundy-900/50 rounded-full px-2 py-0.5 text-lavender-200 mt-1 whitespace-nowrap">
                      {reaction.participantName}
                    </span>
                  </div>
                ))}
              </div>

              {/* YouTube Embed or HTML5 Video element */}
              {youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`}
                  title="YouTube video player"
                  className="w-full h-full object-contain border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video
                  ref={videoRef}
                  controls={showControls && !locked}
                  className="w-full h-full object-contain"
                  src={streamUrl}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onSeeked={handleSeek}
                  onRateChange={handleSpeed}
                  onWaiting={() => setBuffering(true)}
                  onPlaying={() => setBuffering(false)}
                  onLoadedMetadata={handleLoadedMetadata}
                >
                  {roomData?.subtitleTracks?.map((track) => (
                    <track
                      key={track.index}
                      kind="subtitles"
                      src={`${API_BASE_URL}/movies/${id}/subtitles/${track.index}`}
                      srcLang={track.language || "en"}
                      label={track.title}
                    />
                  ))}
                </video>
              )}

              {/* Fullscreen countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs transition-all duration-300">
                  <div className="text-center select-none p-8 animate-pulse">
                    <h1 className="text-5xl md:text-7xl font-black uppercase tracking-widest text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
                      Starts in <span className="text-lavender-400 font-extrabold text-7xl md:text-9xl ml-3 align-middle">{countdown}</span>
                    </h1>
                  </div>
                </div>
              )}

              {/* Screen Fullscreen Chat overlay popup */}
              {chatPopup && (
                <div className="absolute top-6 right-6 z-[9999] w-80 rounded-2xl bg-burgundy-950/90 backdrop-blur-md border border-lavender-500/20 p-4.5 shadow-2xl shadow-black/80 animate-[slideIn_0.3s_ease-out_forwards]">
                  <div className="font-bold text-xs uppercase tracking-wider text-lavender-300 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-lavender-450 animate-ping" />
                    <span>💬 {chatPopup.participantName}</span>
                  </div>
                  <p className="text-sm font-light text-lavender-50 mt-1.5 break-words">
                    {chatPopup.message}
                  </p>
                </div>
              )}
            </div>

            {/* Audio Voice & Movie Launchers */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-b border-burgundy-900/30 pb-5 z-20 relative">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    toggleMute();
                    setMuted((prev) => !prev);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 cursor-pointer ${
                    muted
                      ? "bg-red-950/20 border-red-500/20 text-red-400 hover:bg-red-500/10"
                      : "bg-maroon-800/40 text-lavender-200 border-maroon-700/30 hover:bg-maroon-700 hover:text-white"
                  }`}
                >
                  {muted ? <MicOff size={14} /> : <Mic size={14} />}
                  <span>{muted ? "Microphone Muted" : "Mute Mic"}</span>
                </button>

                <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-burgundy-950/80 border border-burgundy-900/60 text-xs font-semibold text-lavender-300">
                  <span className={`h-2 w-2 rounded-full ${voiceJoined ? "bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400" : "bg-red-500"}`} />
                  <span>{voiceJoined ? "Voice Active" : "Voice Offline"}</span>
                </div>
              </div>

              {isMeHost && (
                <button
                  onClick={startCountdown}
                  className="flex items-center gap-2 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white border border-maroon-600/30 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition duration-300 hover:scale-[1.02] cursor-pointer"
                >
                  <Play size={14} className="fill-current" />
                  <span>Start Live Countdown</span>
                </button>
              )}
            </div>

            {/* Reactions Box */}
            <div className="mt-4 flex flex-col items-center z-20 relative">
              <p className="text-[10px] font-semibold tracking-wider text-lavender-300/40 uppercase mb-2">
                Send Live Emoji Reaction
              </p>
              <div className="flex flex-wrap justify-center gap-2.5 bg-burgundy-950/40 border border-burgundy-900/60 rounded-full px-4.5 py-2 backdrop-blur-xs">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="text-2xl hover:scale-130 transition-all duration-300 select-none cursor-pointer filter hover:drop-shadow-[0_0_8px_rgba(226,215,255,0.6)]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Media status bar & Controls */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 bg-burgundy-950/45 border border-burgundy-900/50 rounded-2xl p-4.5 z-20 relative">
              
              {/* Media descriptors */}
              <div className="flex items-center gap-4 text-xs font-medium text-lavender-200/60">
                <div className="flex items-center gap-1.5 bg-maroon-950/30 border border-maroon-900/20 rounded-lg px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-lavender-200">Playing</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{participants.length} watching</span>
                </div>
                <div>
                  <span className="font-semibold text-lavender-300">{speed}x</span> speed
                </div>
              </div>

              {/* Media actions */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => skipVideo("backward")}
                  className="flex items-center justify-center h-9 w-9 rounded-xl border border-burgundy-900/60 bg-burgundy-950/60 text-lavender-300 hover:text-white hover:bg-burgundy-900/40 transition duration-300"
                  title="Backward 10 seconds"
                >
                  <RotateCcw size={16} />
                </button>

                <button
                  onClick={() => skipVideo("forward")}
                  className="flex items-center justify-center h-9 w-9 rounded-xl border border-burgundy-900/60 bg-burgundy-950/60 text-lavender-300 hover:text-white hover:bg-burgundy-900/40 transition duration-300"
                  title="Forward 10 seconds"
                >
                  <RotateCw size={16} />
                </button>

                <button
                  onClick={toggleLock}
                  className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-bold transition duration-300 cursor-pointer ${
                    locked
                      ? "bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      : "bg-burgundy-950/60 border-burgundy-900/60 text-lavender-350 hover:bg-burgundy-900/40"
                  }`}
                  title={locked ? "Unlock playback controls for all" : "Lock playback controls (Host only)"}
                >
                  {locked ? <Unlock size={13} /> : <Lock size={13} />}
                  <span>{locked ? "Unlock" : "Lock Room"}</span>
                </button>

                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      playerRef.current?.requestFullscreen();
                    }
                  }}
                  className="flex items-center justify-center h-9 w-9 rounded-xl border border-burgundy-900/60 bg-burgundy-950/60 text-lavender-350 hover:text-white hover:bg-burgundy-900/40 transition duration-300"
                  title="Toggle Fullscreen"
                >
                  <Maximize size={15} />
                </button>

                <button
                  onClick={() => setTheatreMode(prev => !prev)}
                  className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-semibold transition duration-300 cursor-pointer ${
                    theatreMode
                      ? "bg-maroon-850/30 border-maroon-700/30 text-lavender-100"
                      : "bg-burgundy-950/60 border-burgundy-900/60 text-lavender-300/70 hover:bg-burgundy-900/40"
                  }`}
                >
                  <Tv size={13} />
                  <span>{theatreMode ? "Theatre: ON" : "Theatre: OFF"}</span>
                </button>

                {/* Audio & Subtitles Settings Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettingsPopover(prev => !prev)}
                    className={`flex items-center justify-center h-9 w-9 rounded-xl border transition-all duration-300 cursor-pointer ${
                      showSettingsPopover
                        ? "bg-lavender-500 border-lavender-450 text-burgundy-950 shadow-lg shadow-lavender-500/20"
                        : "bg-burgundy-950/60 border-burgundy-900/60 text-lavender-350 hover:text-white hover:bg-burgundy-900/40"
                    }`}
                    title="Audio & Subtitles Settings"
                  >
                    <Settings size={15} className={showSettingsPopover ? "animate-spin" : ""} />
                  </button>

                  {showSettingsPopover && (
                    <div className="absolute right-0 bottom-12 w-64 bg-burgundy-950/95 backdrop-blur-md border border-burgundy-900/80 rounded-2xl p-4.5 shadow-2xl z-50 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-burgundy-900/30 pb-2">
                        <Subtitles size={14} className="text-lavender-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-lavender-100">Audio & Subtitles</h4>
                      </div>

                      {/* Audio Tracks Dropdown */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-bold text-lavender-300/60 uppercase tracking-wider">Audio Stream</label>
                        {roomData?.audioTracks && roomData.audioTracks.length > 0 ? (
                          <select
                            value={selectedAudio !== undefined ? selectedAudio : (roomData?.selectedAudioTrackIndex ?? "")}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : undefined;
                              setSelectedAudio(val);
                            }}
                            className="w-full bg-burgundy-900/40 border border-burgundy-900/60 text-xs text-lavender-200 rounded-lg p-2 focus:outline-none focus:border-lavender-500/50"
                          >
                            {roomData.audioTracks.map((track) => (
                              <option key={track.index} value={track.index} className="bg-burgundy-950">
                                {track.title || `Track ${track.index}`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-[10px] text-lavender-300/40 italic">No audio tracks detected</p>
                        )}
                      </div>

                      {/* Subtitle Tracks Dropdown */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-bold text-lavender-300/60 uppercase tracking-wider">Subtitles</label>
                        {roomData?.subtitleTracks && roomData.subtitleTracks.length > 0 ? (
                          <select
                            value={selectedSubtitle !== null ? selectedSubtitle : ""}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : null;
                              selectSubtitleTrack(val);
                            }}
                            className="w-full bg-burgundy-900/40 border border-burgundy-900/60 text-xs text-lavender-200 rounded-lg p-2 focus:outline-none focus:border-lavender-500/50"
                          >
                            <option value="" className="bg-burgundy-950">Off</option>
                            {roomData.subtitleTracks.map((track) => (
                              <option key={track.index} value={track.index} className="bg-burgundy-950">
                                {track.title || `Subtitles ${track.index}`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-[10px] text-lavender-300/40 italic">No embedded subtitles detected</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Participant list & Chat */}
        <div className="space-y-6 lg:h-full lg:flex lg:flex-col justify-between">
          
          {/* Participants panel */}
          <div className="bg-burgundy-900/10 border border-burgundy-900/30 rounded-3xl p-5 shadow-xl flex flex-col max-h-[300px] lg:max-h-[350px]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-lavender-200/50 mb-3.5 flex items-center gap-1.5">
              <Users size={15} className="text-lavender-450" />
              <span>Watchers ({participants.length})</span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between bg-burgundy-950/40 border border-burgundy-900/40 hover:border-burgundy-900/80 rounded-xl p-3 transition duration-300"
                >
                  <div className="flex items-center gap-3">
                    {participant.avatar ? (
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${participant.avatar.gradient} flex items-center justify-center text-xl shadow-md shadow-black/20 select-none`}>
                        {participant.avatar.emoji}
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-maroon-700 to-lavender-650 flex items-center justify-center font-extrabold text-xs text-white uppercase shadow-md shadow-black/20">
                        {participant.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-lavender-50">
                        {participant.name}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${participant.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                        <span className="text-[10px] text-lavender-300/40 font-light">
                          {participant.connected ? "Active" : "Disconnected"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {participant.isHost && (
                    <span className="bg-gradient-to-r from-maroon-700 to-maroon-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-maroon-500/20">
                      Host 👑
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat panel */}
          <div className="bg-burgundy-900/10 border border-burgundy-900/30 rounded-3xl p-5 shadow-xl flex flex-col h-[480px]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-lavender-200/50 mb-3.5 flex items-center gap-1.5">
              <MessageSquare size={15} className="text-lavender-450" />
              <span>Room Chat</span>
            </h2>

            {/* Quick Messages */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3.5 no-scrollbar scrollbar-thin">
              {QUICK_MESSAGES.map((msg) => (
                <button
                  key={msg}
                  onClick={() => sendQuickMessage(msg)}
                  className="whitespace-nowrap rounded-full bg-burgundy-950/75 border border-burgundy-900/50 hover:border-lavender-500/30 text-lavender-200 hover:text-white px-3 py-1.5 text-xs transition duration-300 select-none cursor-pointer"
                >
                  {msg}
                </button>
              ))}
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 min-h-0 bg-burgundy-950/45 border border-burgundy-900/60 rounded-2xl p-4 mb-4 overflow-y-auto space-y-3.5">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-lavender-300/20 space-y-2">
                  <MessageSquare size={36} className="stroke-1" />
                  <p className="text-xs">No chat logs yet. Type something below to engage with the room!</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className="flex flex-col bg-burgundy-950/30 border border-burgundy-900/40 rounded-xl p-3 hover:border-burgundy-900/80 transition duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-lavender-300">
                        {msg.participantName}
                      </span>
                      <span className="text-[9px] font-light text-lavender-300/30">
                        {msg.time}
                      </span>
                    </div>
                    <p className="text-sm text-lavender-50 mt-1 font-light break-words">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Message input */}
            <div className="flex gap-2">
              <input
                className="flex-1 bg-burgundy-950/60 border border-burgundy-900/60 focus:border-lavender-500/50 focus:ring-2 focus:ring-lavender-500/5 rounded-2xl px-4 py-3 text-sm text-lavender-100 placeholder-lavender-200/30 outline-none transition-all duration-300"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                onClick={sendMessage}
                className="flex items-center justify-center bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white rounded-2xl w-12 hover:scale-[1.02] shadow-lg transition duration-300 cursor-pointer"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>



      {/* Host Transfer Dialog modal */}
      {showTransferDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-xs">
          <div className="bg-burgundy-950 border border-burgundy-900/60 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl shadow-black/80 relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-maroon-600/30 to-transparent" />
            <h2 className="text-xl font-bold text-lavender-100 mb-2 flex items-center gap-2">
              <span>👑</span> Transfer Host Control
            </h2>
            <p className="text-sm font-light text-lavender-200/50 mb-5 leading-relaxed">
              As the current room host, you must assign a new host before departing. Select a watcher below:
            </p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {participants
                .filter(p => p.connected && !p.isHost)
                .map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between border rounded-xl p-3.5 cursor-pointer transition duration-300 ${
                      selectedHost === p.id
                        ? "bg-maroon-900/20 border-maroon-500/40 text-lavender-50"
                        : "bg-burgundy-950/40 border-burgundy-900/45 text-lavender-200/60 hover:border-burgundy-900/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="host"
                        value={p.id}
                        className="accent-maroon-500 h-4 w-4"
                        checked={selectedHost === p.id}
                        onChange={() => setSelectedHost(p.id)}
                      />
                      <span className="text-sm font-semibold">{p.name}</span>
                    </div>
                  </label>
                ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setSelectedHost("");
                  setShowTransferDialog(false);
                }}
                className="px-4.5 py-2.5 rounded-xl bg-burgundy-950/40 hover:bg-burgundy-900/20 border border-burgundy-900/60 text-lavender-350 text-xs font-bold transition duration-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!selectedHost}
                onClick={() => {
                  setShowTransferDialog(false);
                  leaveRoomNow(selectedHost);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white border border-maroon-600/30 text-xs font-bold shadow-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Transfer & Leave
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}