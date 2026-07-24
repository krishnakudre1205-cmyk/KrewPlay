import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import roomRoutes from "./routes/room.routes";
import { registerSocketHandlers } from "./sockets";
import movieRoutes from "./routes/movie.routes";

dotenv.config();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/rooms", roomRoutes);
app.use("/movies", movieRoutes);
app.get("/", (_, res) => {
  res.send("KK Cine Server Running 🚀");
});

app.get("/health", (_, res) => {
  res.json({
    status: "OK",
    app: "KK Cine",
    version: "1.0.0",
  });
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});