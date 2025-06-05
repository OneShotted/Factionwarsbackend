const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const players = {};

console.log(`WebSocket server running on port ${PORT}`);

wss.on('connection', (ws) => {
  const id = uuidv4();
  players[id] = {
    id,
    x: 300,
    y: 300,
    username: '',
    faction: '',
    keys: {}
  };

  ws.send(JSON.stringify({ type: 'init', id }));

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      players[id].username = msg.username;
      players[id].faction = msg.faction;
    }

    if (msg.type === 'move') {
      players[id].keys = msg.keys;
    }
  });

  ws.on('close', () => {
    delete players[id];
  });
});

// Movement + state broadcast loop (30 FPS)
setInterval(() => {
  const speed = 3;

  for (let id in players) {
    const p = players[id];

    if (p.keys?.w) p.y -= speed; // Move up (y--)
    if (p.keys?.s) p.y += speed; // Move down (y++)
    if (p.keys?.a) p.x -= speed; // Move left (x--)
    if (p.keys?.d) p.x += speed; // Move right (x++)
  }

  const state = {
    type: 'state',
    players
  };

  const str = JSON.stringify(state);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  });
}, 1000 / 30);
