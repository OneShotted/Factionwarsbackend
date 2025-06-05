const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const players = {};

wss.on("connection", (ws) => {
  const id = uuidv4();
  players[id] = { x: 2500, y: 2500, name: "Unknown", id };

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

  // Broadcast loop
  const interval = setInterval(() => {
    const payload = JSON.stringify({
      type: "players",
      players: Object.values(players)
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }, 1000 / 15); // 15 times per second
});



