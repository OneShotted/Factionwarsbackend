const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

let players = {}; // key: playerId, value: { ws, name, x, y, faction, isDev }

let nextId = 1;

function broadcast(data) {
  const str = JSON.stringify(data);
  for (const id in players) {
    const p = players[id];
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(str);
    }
  }
}

function sendTo(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function generateRandomPosition() {
  return {
    x: Math.floor(Math.random() * 2000),
    y: Math.floor(Math.random() * 2000),
  };
}

wss.on('connection', (ws) => {
  const playerId = nextId++;
  players[playerId] = {
    ws,
    name: null,
    x: 0,
    y: 0,
    faction: null,
    isDev: false,
    inventory: [] // initialize empty inventory
  };

  sendTo(ws, { type: 'id', id: playerId });

  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    switch (data.type) {
      case 'register':
        {
          const nameRaw = data.name || '';
          let isDev = false;
          let name = nameRaw;

          if (nameRaw.includes('#1627')) {
            isDev = true;
            name = nameRaw.replace('#1627', '');
          }

          players[playerId].name = name;
          players[playerId].faction = data.faction || 'red';
          players[playerId].isDev = isDev;

          const pos = generateRandomPosition();
          players[playerId].x = pos.x;
          players[playerId].y = pos.y;

          broadcast({
            type: 'update',
            players: mapPlayers(),
          });
        }
        break;

      case 'movementState':
        {
          const keys = data.keys || {};
          const inventory = data.inventory || [];
          const p = players[playerId];
          if (!p) return;

          // Store inventory from client
          p.inventory = inventory;

          const speed = 5;

          if (keys.up) p.y -= speed;
          if (keys.down) p.y += speed;
          if (keys.left) p.x -= speed;
          if (keys.right) p.x += speed;

          if (p.x < 0) p.x = 0;
          if (p.y < 0) p.y = 0;
          if (p.x > 3000) p.x = 3000;
          if (p.y > 3000) p.y = 3000;
        }
        break;

      case 'chat':
        {
          const p = players[playerId];
          if (!p) return;
          const message = data.message?.toString().substring(0, 200) || '';

          broadcast({
            type: 'chat',
            name: p.name,
            message,
            isBroadcast: false,
          });
        }
        break;

      case 'devCommand':
        {
          const p = players[playerId];
          if (!p || !p.isDev) {
            return;
          }

          const command = data.command;
          if (command === 'broadcast') {
            const msg = data.message || '';
            broadcast({
              type: 'chat',
              message: msg,
              isBroadcast: true,
            });
          } else if (command === 'kick') {
            const targetId = data.targetId;
            if (players[targetId]) {
              sendTo(players[targetId].ws, {
                type: 'kicked',
                reason: 'Kicked by developer',
              });
              players[targetId].ws.close();
              delete players[targetId];
              broadcast({
                type: 'update',
                players: mapPlayers(),
              });
            }
          } else if (command === 'teleport') {
            const targetId = data.targetId;
            const x = Number(data.x);
            const y = Number(data.y);
            if (players[targetId] && !isNaN(x) && !isNaN(y)) {
              players[targetId].x = x;
              players[targetId].y = y;
              broadcast({
                type: 'update',
                players: mapPlayers(),
              });
            }
          }
        }
        break;

      case 'leaveGame':
        {
          ws.close();
        }
        break;
    }
  });

  ws.on('close', () => {
    delete players[playerId];
    broadcast({
      type: 'update',
      players: mapPlayers(),
    });
  });
});

function mapPlayers() {
  const result = {};
  for (const id in players) {
    const p = players[id];
    result[id] = {
      name: p.name,
      x: p.x,
      y: p.y,
      faction: p.faction,
      isDev: p.isDev,
      inventory: p.inventory || []
    };
  }
  return result;
}

setInterval(() => {
  broadcast({
    type: 'update',
    players: mapPlayers(),
  });
}, 1000 / 20);

console.log('WebSocket server started on port 8080');

