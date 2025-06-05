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

// Movement + state broadcast loop
setInterval(() => {
  for (let id in players) {
    const p = players[id];
    const speed = 3;

    if (p.keys?.w) p.y -= speed;
    if (p.keys?.s) p.y += speed;
    if (p.keys?.a) p.x -= speed;
    if (p.keys?.d) p.x += speed;
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
}, 1000 / 30); // 30 FPS

