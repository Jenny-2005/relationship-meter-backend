import { WebSocketServer } from "ws";
import { GameManager } from "./GameManager.js";
import { getDB } from "./db.js";

const PORT = process.env.PORT || 8080;

getDB()
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const wss = new WebSocketServer({ port: Number(PORT) });
const manager = new GameManager();

console.log(`✅ WebSocket server running on port ${PORT}`);

wss.on("connection", (socket) => {
  console.log("🔗 Client connected");
  manager.addUser(socket);
});