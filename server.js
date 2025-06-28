const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

const usersFile = path.join(__dirname, 'users.json');
let users = {};

// Load users from file (if exists)
try {
  const data = fs.readFileSync(usersFile, 'utf8');
  users = JSON.parse(data);
  console.log('Loaded users:', Object.keys(users).length);
} catch (e) {
  console.log('No existing users.json, starting fresh.');
  users = {};
}

// Save users to file (async)
function saveUsers() {
  fs.writeFile(usersFile, JSON.stringify(users, null, 2), (err) => {
    if (err) console.error('Error saving users.json:', err);
  });
}

const players = {}; // key: playerId -> { x, y, z, rotY, username, health }

// Helper: find user by username
function findUserByUsername(username) {
  return Object.values(users).find(u => u.username === username);
}

// Helper: create new user
async function createUser(username, password) {
  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();
  users[id] = { id, username, password_hash: hashed };
  saveUsers();
  return { id, username };
}

// Helper: verify password
async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

// Respawn a player at default spawn point with full health
function respawnPlayer(id) {
  players[id].x = 0;
  players[id].y = 1;
  players[id].z = 0;
  players[id].rotY = 0;
  players[id].health = 100;
}

wss.on('connection', (ws) => {
  let playerId = null;
  let username = null;

  ws.send(JSON.stringify({ type: 'connected' }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Signup
      if (data.type === 'signup' && data.username && data.password) {
        const existingUser = findUserByUsername(data.username);
        if (existingUser) {
          ws.send(JSON.stringify({ type: 'signup', success: false, error: 'Username taken' }));
          return;
        }
        const newUser = await createUser(data.username, data.password);
        playerId = newUser.id;
        username = newUser.username;
        players[playerId] = { x: 0, y: 1, z: 0, rotY: 0, username, health: 100 };
        ws.send(JSON.stringify({ type: 'signup', success: true, id: playerId, username }));
        broadcastPlayers();
        return;
      }

      // Login
      if (data.type === 'login' && data.username && data.password) {
        const user = findUserByUsername(data.username);
        if (!user) {
          ws.send(JSON.stringify({ type: 'login', success: false, error: 'User not found' }));
          return;
        }
        const valid = await verifyPassword(user, data.password);
        if (!valid) {
          ws.send(JSON.stringify({ type: 'login', success: false, error: 'Invalid password' }));
          return;
        }
        playerId = user.id;
        username = user.username;
        if (!players[playerId]) {
          players[playerId] = { x: 0, y: 1, z: 0, rotY: 0, username, health: 100 };
        }
        ws.send(JSON.stringify({ type: 'login', success: true, id: playerId, username }));
        broadcastPlayers();
        return;
      }

      // Movement update
      if (data.type === 'move' && playerId && data.position) {
        if (!players[playerId]) return;
        players[playerId].x = data.position.x;
        players[playerId].y = data.position.y;
        players[playerId].z = data.position.z;
        players[playerId].rotY = data.position.rotY || 0;
        // health stays unchanged here
        broadcastPlayers();
        return;
      }

      // Attack handling
      if (data.type === 'attack' && playerId && data.targetId) {
        if (!players[playerId] || !players[data.targetId]) return; // must be valid players

        // Basic distance check for security: attacker must be close enough to target (e.g. <=4 units)
        const attacker = players[playerId];
        const target = players[data.targetId];
        const dx = attacker.x - target.x;
        const dy = attacker.y - target.y;
        const dz = attacker.z - target.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > 16) { // 4 squared = 16
          // Ignore attack if too far
          return;
        }

        // Apply damage
        target.health = (target.health || 100) - 10;
        if (target.health <= 0) {
          // Respawn target
          respawnPlayer(data.targetId);
        }

        broadcastPlayers();
        return;
      }

    } catch (e) {
      console.error('Error processing message:', e);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or server error' }));
    }
  });

  ws.on('close', () => {
    if (playerId) {
      delete players[playerId];
      broadcastPlayers();
    }
  });

  function broadcastPlayers() {
    const payload = JSON.stringify({
      type: 'update',
      players,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
});

console.log('WebSocket server running on port', process.env.PORT || 3000);


