import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../../services/socket";
import TopBar from "../../components/room/TopBar";

type Participant = {
  id: string;
  name: string;
  isHost: boolean;
};

type RoomData = {
  code: string;
  participants: Participant[];
};

type ChatMessage = {
  participantName: string;
  message: string;
  time: string;
};

export default function Room() {
  const { id } = useParams();

  const videoRef = useRef<HTMLVideoElement>(null);
  const isSyncing = useRef(false);
  const activityTimeout = useRef<number | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState("");
  const [speed, setSpeed] = useState(1);

  async function loadRoom() {
    if (!id) return;

    try {
      const res = await fetch(`http://localhost:5000/rooms/${id}`);

      if (!res.ok) return;

      const room: RoomData = await res.json();
      setParticipants(room.participants);
    } catch (err) {
      console.error(err);
    }
  }

  function syncPlayer(
  action: "play" | "pause" | "seek" | "speed"
) {
  if (isSyncing.current || !videoRef.current) return;

  const participantId = localStorage.getItem("participantId");

  const me = participants.find(
    (p) => p.id === participantId
  );

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
  syncPlayer("play");
}

function handlePause() {
  syncPlayer("pause");
}

function handleSeek() {
  syncPlayer("seek");
}

function handleSpeed() {
  if(videoRef.current){
    setSpeed(videoRef.current.playbackRate);
}
  syncPlayer("speed");
}

  function sendMessage() {
    if (!message.trim()) return;

    const participantId = localStorage.getItem("participantId");

    const me = participants.find(
      (p) => p.id === participantId
    );

    if (!me) return;

    socket.emit("send-message", {
      roomCode: id,
      participantName: me.name,
      message,
    });

    setMessage("");
  }

  useEffect(() => {
    if (!id) return;

    loadRoom();

    function handleUserJoined() {
      loadRoom();
    }

    function handleNewMessage(data: ChatMessage) {
      setMessages((prev) => [...prev, data]);
    }

    function handlePlayerSync(data: {
  participantName: string;

  action: "play" | "pause" | "seek" | "speed";

  player: {
    isPlaying: boolean;
    currentTime: number;
    playbackRate: number;
    lastUpdated: number;
  };
}) {
  if (!videoRef.current) return;

  isSyncing.current = true;

  if (
  Math.abs(
    videoRef.current.currentTime - data.player.currentTime
  ) > 0.5
) {
  videoRef.current.currentTime = data.player.currentTime;
}

  videoRef.current.playbackRate =
    data.player.playbackRate;
  setSpeed(data.player.playbackRate);
  let text = "";

switch (data.action) {
  case "play":
    text = `▶️ ${data.participantName} played the movie`;
    break;

  case "pause":
    text = `⏸️ ${data.participantName} paused the movie`;
    break;

  case "seek":
    text = `⏩ ${data.participantName} skipped`;
    break;

  case "speed":
    text = `⚡ ${data.participantName} changed speed to ${data.player.playbackRate}x`;
    break;
}

setActivity(text);

if (activityTimeout.current) {
  clearTimeout(activityTimeout.current);
}

activityTimeout.current = window.setTimeout(() => {
  setActivity("");
}, 3000);

  if (data.player.isPlaying && videoRef.current.paused) {
  videoRef.current.play().catch(() => {});
}

if (!data.player.isPlaying && !videoRef.current.paused) {
  videoRef.current.pause();
}

  setTimeout(() => {
    isSyncing.current = false;
  }, 150);
}


function handlePlayerState(player: {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  lastUpdated: number;
}) {
  if (!videoRef.current) return;

  isSyncing.current = true;

  if (
  Math.abs(
    videoRef.current.currentTime - player.currentTime
  ) > 0.5
) {
  videoRef.current.currentTime = player.currentTime;
}
  videoRef.current.playbackRate = player.playbackRate;
  setSpeed(player.playbackRate);
  if (player.isPlaying && videoRef.current.paused) {
  videoRef.current.play().catch(() => {});
}

if (!player.isPlaying && !videoRef.current.paused) {
  videoRef.current.pause();
}

  setTimeout(() => {
    isSyncing.current = false;
  }, 150);
}
socket.on("player-sync", handlePlayerSync);
socket.on("player-state", handlePlayerState);
socket.on("user-joined", handleUserJoined);
socket.on("new-message", handleNewMessage);
    

return () => {
  socket.off("user-joined", handleUserJoined);
  socket.off("new-message", handleNewMessage);
  socket.off("player-sync", handlePlayerSync);
  socket.off("player-state", handlePlayerState);

  if (activityTimeout.current) {
    clearTimeout(activityTimeout.current);
  }
};
  }, [id]);

  return (
  <div className="min-h-screen bg-[#0D0D0D] text-white p-8">
      <TopBar roomCode={id ?? ""} />

      {/* Video Player */}
      <div className="bg-[#1A1A1A] border border-[#343434] rounded-2xl p-6 mb-8 shadow-xl">
        {activity && (
  <div className="mb-5 w-fit rounded-xl border border-[#B497FF] bg-[#23172E] px-5 py-3 text-[#E9DDFF] shadow-lg">
    {activity}
  </div>
)}

        
        <video
  ref={videoRef}
  controls
  className="w-full rounded-2xl bg-black border border-[#343434]"
  src={`http://localhost:5000/movies/${id}/stream`}
  onPlay={handlePlay}
  onPause={handlePause}
  onSeeked={handleSeek}
  onRateChange={handleSpeed}
/>

  <div className="mt-4 flex items-center justify-between bg-[#252525] border border-[#343434] rounded-xl px-5 py-3">

<div className="flex items-center gap-2">
    <span className="text-green-400">▶</span>
    <span>Watching</span>
</div>

<div className="flex items-center gap-2">
    <span>👥</span>
    <span>{participants.length}</span>
</div>

<div className="flex items-center gap-2">
    <span>⚡</span>
    <span>{speed}x</span>
</div>

<button
onClick={()=>{
if(document.fullscreenElement){
document.exitFullscreen();
}else{
videoRef.current?.requestFullscreen();
}
}}
className="rounded-lg bg-[#8A1538] px-4 py-2 hover:bg-[#6D1124]"
>
Fullscreen
</button>

</div>

    
    

      </div>

      {/* Participants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

<div className="bg-[#1A1A1A] border border-[#343434] rounded-2xl p-5 max-h-[520px] overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-4">
          Participants
        </h2>

        {participants.map((participant) => (
  <div
    key={participant.id}
    className="flex items-center justify-between bg-[#252525] hover:bg-[#2F2F2F] rounded-xl p-3 mb-3 transition"
  >
    <div className="flex items-center gap-3">

      <div className="w-11 h-11 rounded-full bg-[#B497FF] flex items-center justify-center font-bold text-black">
        {participant.name.charAt(0).toUpperCase()}
      </div>

      <div>

        <div className="font-semibold text-white">
          {participant.name}
        </div>

        <div className="text-green-400 text-xs">
          ● Watching
        </div>

      </div>

    </div>

    {participant.isHost && (
      <span className="bg-[#8A1538] text-white px-3 py-1 rounded-full text-xs">
        Host 👑
      </span>
    )}
  </div>
))}
      </div>

      {/* Chat */}
      

<div className="lg:col-span-2 bg-[#1A1A1A] border border-[#343434] rounded-2xl p-5">
        <h2 className="text-2xl font-semibold mb-4">
          Chat
        </h2>

        <div className="h-72 overflow-y-auto bg-[#252525] rounded-xl p-4 mb-4">
          {messages.length === 0 ? (
            <p className="text-gray-500">
              No messages yet.
            </p>
          ) : (
            messages.map((msg, index) => (
              <div
  key={index}
  className="mb-4 bg-[#1A1A1A] rounded-xl p-3 border border-[#343434]"
>
                <div className="font-semibold">
                  {msg.participantName}
                </div>

                <div>{msg.message}</div>

                <div className="mt-1 text-xs text-[#9CA3AF]">
  {msg.time}
</div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#252525] border border-[#343434] rounded-xl px-4 py-3 outline-none focus:border-[#B497FF]"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button
            onClick={sendMessage}
            className="bg-[#8A1538] hover:bg-[#6D1124] text-white px-6 rounded-xl transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}