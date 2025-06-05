const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const players = {};

wss.on("connection", (ws) => {
  const id = uuidv4();
  players[id] = {
    id,
    name: "Unknown",
    x: 2500,
    y: 2500
  };

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "join") {
        players[id].name = data.name;
      }

      if (data.type === "move") {
        players[id].x = data.x;
        players[id].y = data.y;
      }
    } catch (e) {
      console.error("Invalid message:", message);
    }
  });

  ws.on("close", () => {
    delete players[id];
  });

  // Broadcast all players every 1/15 second
  const interval = setInterval(() => {
    const payload = JSON.stringify({
      type: "players",
      players: Object.values(players)
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }, 1000 / 15);
});


