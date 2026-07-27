import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import roomRoutes from "./routes/room.routes";
import { registerSocketHandlers } from "./sockets";
import movieRoutes from "./routes/movie.routes";
import authRoutes from "./routes/auth.routes";

dotenv.config();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/rooms", roomRoutes);
app.use("/movies", movieRoutes);
app.use("/auth", authRoutes);
app.get("/", (_, res) => {
  res.send("KrewPlay Server Running 🚀");
});

app.get("/health", (_, res) => {
  res.json({
    status: "OK",
    app: "KrewPlay",
    version: "1.0.0",
  });
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;