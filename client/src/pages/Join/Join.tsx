import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../../services/socket";

export default function Join() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const navigate = useNavigate();

  async function joinRoom() {
    if (!name.trim() || !roomCode.trim()) {
      alert("Enter your name and room code");
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:5000/rooms/${roomCode}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        alert(error.message || "Failed to join room");
        return;
      }

      const data = await res.json();
      localStorage.setItem("participantId", data.participant.id);

      console.log(data);

      // Join the Socket.IO room
      socket.emit("join-room", {
  roomCode,
  participantId: data.participant.id,
});

      // Navigate to the room page
      navigate(`/room/${roomCode}`);
    } catch (err) {
      console.error(err);
      alert("Failed to join room");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-4xl font-bold">Join Room</h1>

      <input
        className="border p-2 rounded w-72"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="border p-2 rounded w-72"
        placeholder="Enter room code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
      />

      <button
        onClick={joinRoom}
        className="bg-green-600 text-white px-5 py-2 rounded"
      >
        Join Room
      </button>
    </div>
  );
}