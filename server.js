const WebSocket = require('ws');
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let players = {};
let idCounter = 0;

wss.on('connection', (socket) => {
  const playerId = `player_${idCounter++}`;
  console.log(`[+] New connection: ${playerId}`);

  socket.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch (e) {
      return;
    }

    if (message.type === 'join') {
      players[playerId] = {
        id: playerId,
        name: message.name,
        faction: message.faction,
        x: Math.random() * 800,
        y: Math.random() * 600,
      };
      console.log(`[JOIN] ${message.name} (${message.faction}) joined as ${playerId}`);
    }
  });

  socket.on('close', () => {
    console.log(`[-] Disconnected: ${playerId}`);
    delete players[playerId];
  });

  // Attach ID to socket
  socket.id = playerId;
});

// Broadcast loop
setInterval(() => {
  const payload = JSON.stringify({
    type: 'state',
    players: players
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}, 50);

server.listen(PORT, () => {
  console.log(`FactionWars.io server running on port ${PORT}`);
});
