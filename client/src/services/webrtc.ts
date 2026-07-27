import { socket } from "./socket";

const peers = new Map<string, RTCPeerConnection>();
const remoteAudios = new Map<string, HTMLAudioElement>();

let localStream: MediaStream | null = null;

const config: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export async function joinVoice(roomCode: string) {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  }

  socket.emit("voice-join", { roomCode });

  socket.off("voice-user-joined");
  socket.off("voice-offer");
  socket.off("voice-answer");
  socket.off("voice-ice-candidate");
  socket.off("voice-user-left");

  socket.on("voice-user-joined", async ({ socketId }) => {
    if (peers.has(socketId)) return;

    const peer = createPeer(socketId);
    peers.set(socketId, peer);

    localStream!.getTracks().forEach((track) => {
      peer.addTrack(track, localStream!);
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("voice-offer", {
      roomCode,
      target: socketId,
      offer,
    });
  });

  socket.on("voice-offer", async ({ from, offer }) => {
    let peer = peers.get(from);

    if (!peer) {
      peer = createPeer(from);
      peers.set(from, peer);

      localStream!.getTracks().forEach((track) => {
        peer!.addTrack(track, localStream!);
      });
    }

    await peer.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("voice-answer", {
      target: from,
      answer,
    });
  });

  socket.on("voice-answer", async ({ from, answer }) => {
    const peer = peers.get(from);

    if (!peer) return;

    await peer.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  });

  socket.on("voice-ice-candidate", async ({ from, candidate }) => {
    console.log("Received ICE", candidate);

    const peer = peers.get(from);

    if (!peer) return;

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("ICE add failed", err);
    }
  });

  socket.on("voice-user-left", (socketId: string) => {
    peers.get(socketId)?.close();
    peers.delete(socketId);

    const audio = remoteAudios.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudios.delete(socketId);
    }
  });
}

function createPeer(socketId: string) {
  const peer = new RTCPeerConnection(config);

  peer.onicecandidate = (event) => {
    console.log("Sending ICE", event.candidate);

    if (!event.candidate) return;

    socket.emit("voice-ice-candidate", {
      target: socketId,
      candidate: event.candidate,
    });
  };

  peer.onconnectionstatechange = () => {
    console.log(
      "Peer",
      socketId,
      "connection:",
      peer.connectionState
    );
  };

  peer.oniceconnectionstatechange = () => {
    console.log(
      "ICE",
      socketId,
      peer.iceConnectionState
    );
  };

  peer.ontrack = (event) => {
    let audio = remoteAudios.get(socketId);

    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      remoteAudios.set(socketId, audio);
    }

    audio.srcObject = event.streams[0];

    audio.play().catch(console.error);

    console.log("Remote audio received from", socketId);
  };

  return peer;
}

export function toggleMute() {
  if (!localStream) return;

  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !track.enabled;
  });
}

export function leaveVoice() {
  peers.forEach((peer) => peer.close());
  peers.clear();

  remoteAudios.forEach((audio) => {
    audio.pause();
    audio.srcObject = null;
  });

  remoteAudios.clear();

  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;

  socket.off("voice-user-joined");
  socket.off("voice-offer");
  socket.off("voice-answer");
  socket.off("voice-ice-candidate");
  socket.off("voice-user-left");
}