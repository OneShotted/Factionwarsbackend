// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const players = {}; // playerId -> player data

// Utility: generate unique player IDs
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function broadcastUpdate() {
  const updateData = {
    players: Object.values(players).map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      faction: p.faction,
      name: p.name,
      inventory: p.inventory,
      isDev: p.isDev
    }))
  };

  const msg = JSON.stringify({ type: 'update', data: updateData });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  // Initialize new player
  const playerId = generateId();

  // Create default player data
  players[playerId] = {
    id: playerId,
    x: Math.random() * 800,
    y: Math.random() * 600,
    faction: 'red',   // default faction, can be set by client later
    name: 'Anonymous',
    inventory: [
      { name: 'Basic', icon: '⚪' }  // default inventory with "Basic" item
    ],
    isDev: false
  };

  // Send back initial info (your player id)
  ws.send(JSON.stringify({ type: 'init', data: { id: playerId } }));

  // Listen for messages from this client
  ws.on('message', (message) => {
    let msg = null;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON from client:', message);
      return;
    }

    if (!msg.type) return;

    if (msg.type === 'updatePlayer') {
      const data = msg.data;
      if (!players[playerId]) return;

      // Update player position & info
      if (typeof data.x === 'number') players[playerId].x = data.x;
      if (typeof data.y === 'number') players[playerId].y = data.y;
      if (typeof data.name === 'string') players[playerId].name = data.name;
      if (typeof data.faction === 'string') players[playerId].faction = data.faction;
      if (Array.isArray(data.inventory)) players[playerId].inventory = data.inventory;

      // You can add more fields as needed
    }

    // Add other message handling as needed (chat, dev commands, etc.)
  });

  ws.on('close', () => {
    delete players[playerId];
  });
});

// Broadcast updates 20 times per second
setInterval(broadcastUpdate, 1000 / 20);

console.log('Server started on ws://localhost:8080');

