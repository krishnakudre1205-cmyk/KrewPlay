import { useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { socket } from "../../services/socket";

export default function Host() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploadProgress, setUploadProgress] = useState(0);

  const [roomCreated, setRoomCreated] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [uploaded, setUploaded] = useState(false);

  async function createRoom() {
    if (!name.trim()) {
      alert("Enter your name");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostName: name,
        }),
      });

      const data = await res.json();

      localStorage.setItem("participantId", data.participants[0].id);

      socket.emit("join-room", {
        roomCode: data.code,
        participantId: data.participants[0].id,
      });

      setRoomCode(data.code);
      setRoomCreated(true);
    } catch (err) {
      console.error(err);
      alert("Failed to create room");
    }
  }

  function onFileChange(file: File | null) {
    if (!file) return;

    setSelectedFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();

    if (e.dataTransfer.files.length > 0) {
      onFileChange(e.dataTransfer.files[0]);
    }
  }

  async function uploadMovie() {
    if (!selectedFile) {
      alert("Select a movie");
      return;
    }

    try {
      setUploading(true);

      const form = new FormData();

      form.append("movie", selectedFile);

      await axios.post(
        `http://localhost:5000/movies/${roomCode}/upload`,
        form,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },

          onUploadProgress(progressEvent) {
            if (!progressEvent.total) return;

            const percent = Math.round(
              (progressEvent.loaded * 100) /
                progressEvent.total
            );

            setUploadProgress(percent);
          },
        }
      );

      setUploaded(true);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">

      <div className="bg-gray-900 rounded-xl p-8 w-[600px]">

        <h1 className="text-4xl font-bold mb-6 text-center">
          🎬 KK Cine
        </h1>

        {!roomCreated && (
          <>
            <input
              className="w-full p-3 rounded bg-gray-800"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <button
              onClick={createRoom}
              className="mt-5 w-full bg-blue-600 hover:bg-blue-700 p-3 rounded"
            >
              Create Room
            </button>
          </>
        )}

        {roomCreated && (
          <>
            <h2 className="text-xl mt-4">
              Room Code :
              <span className="font-bold text-green-400">
                {" "}
                {roomCode}
              </span>
            </h2>

            <div
              className="border-2 border-dashed border-gray-600 rounded-lg mt-6 p-10 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <p>Drag & Drop Movie Here</p>

              <p className="my-3">OR</p>

              <input
                type="file"
                accept=".mp4,.mkv,.webm,.avi"
                onChange={(e) =>
                  onFileChange(
                    e.target.files
                      ? e.target.files[0]
                      : null
                  )
                }
              />
            </div>

            {selectedFile && (
              <div className="mt-5">

                <p>
                  <strong>Name:</strong>{" "}
                  {selectedFile.name}
                </p>

                <p>
                  <strong>Size:</strong>{" "}
                  {(selectedFile.size / 1024 / 1024).toFixed(
                    2
                  )}{" "}
                  MB
                </p>

                <button
                  onClick={uploadMovie}
                  disabled={uploading}
                  className="bg-green-600 mt-5 px-6 py-3 rounded"
                >
                  Upload Movie
                </button>

                {uploading && (
                  <div className="mt-4">

                    <div className="w-full bg-gray-700 rounded">

                      <div
                        className="bg-green-500 h-4 rounded"
                        style={{
                          width: `${uploadProgress}%`,
                        }}
                      />

                    </div>

                    <p className="mt-2">
                      {uploadProgress}%
                    </p>

                  </div>
                )}

                {uploaded && (
                  <>
                    <p className="text-green-400 mt-4">
                      ✓ Upload Successful
                    </p>

                    <button
                      className="mt-4 bg-blue-600 px-6 py-3 rounded"
                      onClick={() =>
                        navigate(`/room/${roomCode}`)
                      }
                    >
                      Enter Watch Room
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

      </div>

    </div>
  );
}