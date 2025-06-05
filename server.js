const WebSocket = require("ws");
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

let players = {};

wss.on("connection", (ws) => {
  let playerId = Math.random().toString(36).substr(2, 9);
  players[playerId] = { id: playerId };

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "join") {
      players[playerId].name = data.name;
      console.log(`${data.name} joined.`);
    }
  });

  ws.on("close", () => {
    delete players[playerId];
  });

  ws.send(JSON.stringify({ type: "welcome", id: playerId }));
});

console.log("Server running...");

