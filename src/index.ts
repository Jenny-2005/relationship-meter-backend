import WebSocket, { WebSocketServer } from "ws";
import { GameManager } from "./GameManager.js";

try {
  const wss = new WebSocketServer({ port: 8080 });
  const manager = new GameManager();

  console.log("✅ WebSocket server running on ws://localhost:8080");

  wss.on("connection", (socket) => {
    console.log("🔗 New client connected");
    manager.addUser(socket);

    socket.on("close", () => console.log("❌ Client disconnected"));
  });

} catch (err) {
  console.error("🔥 SERVER CRASHED:");
  console.error(err);
}
