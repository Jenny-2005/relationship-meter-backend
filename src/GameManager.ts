import type { WebSocket } from "ws";
import { INIT_GAME, MOVE } from "./messages.js";
import { Game } from "./Game.js";
import questions from "./questions.js";

type RoomPlayer = {
  socket: WebSocket;
  avatar: string;
};

type Room = {
  player1: RoomPlayer;
  player2?: RoomPlayer;
};

const rooms = new Map<string, Room>();

export class GameManager {
  private games: Game[] = [];
  private users: WebSocket[] = [];

  constructor() {}

  addUser(socket: WebSocket) {
    this.users.push(socket);
    this.addHandler(socket);
  }

  removeUser(socket: WebSocket) {
    this.users = this.users.filter(user => user !== socket);

    // Remove any game this user was in
    this.games = this.games.filter(
      game =>
        game.player1 !== socket &&
        game.player2 !== socket
    );

    // Handle room cleanup
    for (const [roomId, room] of rooms) {
      if (room.player1.socket === socket) {
        if (!room.player2) {
          rooms.delete(roomId);
          console.log("🛑 Room deleted (player1 left):", roomId);
        } else {
          // Promote player2 to player1 safely
          room.player1 = room.player2;
          room.player2 = undefined;
        }
      } 
      else if (room.player2?.socket === socket) {
        room.player2 = undefined;
      }
    }
  }

  private addHandler(socket: WebSocket) {
    socket.on("message", data => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (err) {
        console.error("❌ BAD JSON RECEIVED:", data.toString());
        return;
      }

      // ---------------- CREATE ROOM ----------------
      if (message.type === "CREATE_ROOM") {
        const roomId = Math.random().toString(36).substring(2, 8);

        rooms.set(roomId, {
          player1: { socket, avatar: "" }
        });

        socket.send(JSON.stringify({
          type: "ROOM_CREATED",
          roomId,
          status: "waiting_for_player"
        }));

        console.log("🎮 Room created:", roomId);
        return;
      }

      // ---------------- JOIN ROOM ----------------
      if (message.type === "JOIN_ROOM") {
        const { roomId } = message;

        if (!rooms.has(roomId)) {
          socket.send(JSON.stringify({
            type: "INVALID_ROOM",
            reason: "Room does not exist"
          }));
          return;
        }

        const room = rooms.get(roomId)!;

        if (room.player2) {
          socket.send(JSON.stringify({ type: "ROOM_FULL" }));
          return;
        }

        room.player2 = { socket, avatar: "" };

        socket.send(JSON.stringify({
          type: "ROOM_JOINED",
          roomId,
          playerNumber: 2,
        }));

        room.player1.socket.send(JSON.stringify({
          type: "PLAYER_JOINED",
          roomId,
        }));

        console.log("👤 Player 2 joined", roomId);
        return;
      }
      if (message.type === "SUBMIT_AVATAR") {
        const { roomId, avatar } = message;

        if (!rooms.has(roomId)) {
          socket.send(JSON.stringify({ type: "INVALID_ROOM" }));
          return;
        }

        const room = rooms.get(roomId)!;

        if (room.player1.socket === socket) {
          room.player1.avatar = avatar;
          console.log("🕒 Player 1 submitted:", avatar);
        } 
        else if (room.player2?.socket === socket) {
          room.player2.avatar = avatar;
          console.log("🕒 Player 2 submitted:", avatar);
        }

        // Tell the OTHER player what avatar was chosen
        if (room.player1.socket === socket && room.player2) {
          room.player2.socket.send(JSON.stringify({
            type: "PARTNER_AVATAR_SELECTED",
            avatar: room.player1.avatar
          }));
        }

        if (room.player2?.socket === socket) {
          room.player1.socket.send(JSON.stringify({
            type: "PARTNER_AVATAR_SELECTED",
            avatar: room.player2.avatar
          }));
        }
      }

        // ---- START GAME ONLY AFTER BOTH SUBMIT ----
        if (message.type === "SUBMIT_AVATAR") {
          const { roomId, avatar } = message;

          if (!rooms.has(roomId)) {
            socket.send(JSON.stringify({ type: "INVALID_ROOM" }));
            return;
          }

          const room = rooms.get(roomId)!;

          // --- Assign avatar ---
          if (room.player1.socket === socket) {
            room.player1.avatar = avatar;
            console.log("🕒 Player 1 submitted:", avatar);
          } else if (room.player2?.socket === socket) {
            room.player2.avatar = avatar;
            console.log("🕒 Player 2 submitted:", avatar);
          }

          // --- Notify partner ---
          if (room.player1.socket === socket && room.player2) {
            room.player2.socket.send(JSON.stringify({
              type: "PARTNER_AVATAR_SELECTED",
              avatar: room.player1.avatar
            }));
          }

          if (room.player2?.socket === socket) {
            room.player1.socket.send(JSON.stringify({
              type: "PARTNER_AVATAR_SELECTED",
              avatar: room.player2.avatar
            }));
          }

          // --- Start game ONLY when both avatars exist ---
          const player2 = room.player2;
          if (!player2) return;

          if (room.player1.avatar && player2.avatar) {
            const game = new Game(
              room.player1.socket,
              player2.socket,
              questions,
              room.player1.avatar,
              player2.avatar
            );

            this.games.push(game);
            console.log("🎮 Game started in room:", roomId);
            return;
          }

          // --- Otherwise wait ---
          if (room.player1.avatar && !player2.avatar) {
            room.player1.socket.send(JSON.stringify({
              type: "WAITING_FOR_PLAYER",
              roomId
            }));
          }

          if (player2.avatar && !room.player1.avatar) {
            player2.socket.send(JSON.stringify({
              type: "WAITING_FOR_PLAYER",
              roomId
            }));
          }
        }

      // ---------------- HANDLE MOVES ----------------
      if (message.type === "ANSWER") {
        const game = this.games.find(
          g => g.player1 === socket || g.player2 === socket
        );

        if (game) {
          game.makeMove(socket, message.answer);
        }
      }
    });

    socket.on("close", () => this.removeUser(socket));
  }
}
