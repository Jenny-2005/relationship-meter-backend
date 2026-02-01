import { randomUUID } from "crypto";
import { getDB } from "./db.js";
const TOTAL_CHAIRS = 82;
const MIN_POS = 0;
const MAX_POS = TOTAL_CHAIRS - 1;
function generateRoomId() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "";
    for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}
export class Game {
    constructor(player1, player2, questions, avatar1, avatar2) {
        this.player1 = player1;
        this.player2 = player2;
        this.avatar1 = avatar1;
        this.avatar2 = avatar2;
        this.questions = questions;
        this.currentQuestionIndex = 0;
        // starting positions
        this.positions = new Map([
            [player1, 40],
            [player2, 41]
        ]);
        this.answers = new Map();
        this.distance = 1;
        this.sessionId = randomUUID();
        this.startTime = new Date();
        // send start payloads
        this.sendGameStartPayloads();
        // send first question
        this.sendQuestion();
    }
    // ------------------------------------------------------------------
    // GAME START PAYLOAD
    // ------------------------------------------------------------------
    sendGameStartPayloads() {
        const p1 = this.positions.get(this.player1);
        const p2 = this.positions.get(this.player2);
        // payload to PLAYER-1
        this.player1.send(JSON.stringify({
            type: "GAME_STARTED",
            yourPlayerNumber: 1,
            yourAvatar: this.avatar1,
            opponentAvatar: this.avatar2,
            yourPosition: p1,
            opponentPosition: p2
        }));
        // payload to PLAYER-2
        this.player2.send(JSON.stringify({
            type: "GAME_STARTED",
            yourPlayerNumber: 2,
            yourAvatar: this.avatar2,
            opponentAvatar: this.avatar1,
            yourPosition: p2,
            opponentPosition: p1
        }));
    }
    // ------------------------------------------------------------------
    // HANDLE ANSWER
    // ------------------------------------------------------------------
    makeMove(socket, answer) {
        this.answers.set(socket, answer);
        // wait until both have answered
        if (this.answers.size < 2)
            return;
        const question = this.questions[this.currentQuestionIndex];
        const answer1 = this.answers.get(this.player1);
        const answer2 = this.answers.get(this.player2);
        const move1 = question.moveAnswers.includes(answer1);
        const move2 = question.moveAnswers.includes(answer2);
        let pos1 = this.positions.get(this.player1);
        let pos2 = this.positions.get(this.player2);
        // ------------------------------------------------------------
        // PLAYER-1 always moves LEFT when move-away answer matched
        // ------------------------------------------------------------
        if (move1) {
            pos1 = Math.max(MIN_POS, pos1 - 1);
            this.positions.set(this.player1, pos1);
        }
        // ------------------------------------------------------------
        // PLAYER-2 always moves RIGHT when move-away answer matched
        // ------------------------------------------------------------
        if (move2) {
            pos2 = Math.min(MAX_POS, pos2 + 1);
            this.positions.set(this.player2, pos2);
        }
        // compute distance
        this.distance = Math.abs(pos1 - pos2);
        // ------------------------------------------------------------
        // SEND UPDATE (mirrored per-player)
        // ------------------------------------------------------------
        this.player1.send(JSON.stringify({
            type: "UPDATE",
            yourPosition: pos1,
            opponentPosition: pos2,
            distance: this.distance
        }));
        this.player2.send(JSON.stringify({
            type: "UPDATE",
            yourPosition: pos2,
            opponentPosition: pos1,
            distance: this.distance
        }));
        // clear answers
        this.answers.clear();
        // next question
        this.currentQuestionIndex++;
        if (this.currentQuestionIndex >= this.questions.length) {
            this.endGame();
        }
        else {
            this.sendQuestion();
        }
    }
    // ------------------------------------------------------------------
    // SEND QUESTION
    // ------------------------------------------------------------------
    sendQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        const payload = JSON.stringify({
            type: "QUESTION",
            id: q.id,
            text: q.text
        });
        this.player1.send(payload);
        this.player2.send(payload);
    }
    // ------------------------------------------------------------------
    // END GAME + SAVE SESSION
    // ------------------------------------------------------------------
    async endGame() {
        await saveSession({
            sessionId: this.sessionId,
            totalDistance: this.distance,
            durationMs: Date.now() - this.startTime.getTime()
        });
        const payload = JSON.stringify({
            type: "GAME_OVER",
            distance: this.distance
        });
        this.player1.send(payload);
        this.player2.send(payload);
    }
}
// ------------------------------------------------------------------
// DB SAVE
// ------------------------------------------------------------------
async function saveSession(data) {
    const db = await getDB();
    const collection = db.collection("sessions");
    await collection.insertOne({
        sessionId: data.sessionId,
        distance: data.totalDistance,
        durationMs: data.durationMs,
        createdAt: new Date()
    });
    console.log("📊 Research Data Saved:", data.sessionId);
}
