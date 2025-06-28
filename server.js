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

const players = {}; // In-memory player positions keyed by id

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

wss.on('connection', (ws) => {
  let playerId = null;
  let username = null;

  ws.send(JSON.stringify({ type: 'connected' }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Handle signup
      if (data.type === 'signup' && data.username && data.password) {
        const existingUser = findUserByUsername(data.username);
        if (existingUser) {
          ws.send(JSON.stringify({ type: 'signup', success: false, error: 'Username taken' }));
          return;
        }
        const newUser = await createUser(data.username, data.password);
        playerId = newUser.id;
        username = newUser.username;
        players[playerId] = { x: 0, y: 1, z: 0, rotY: 0, username };
        ws.send(JSON.stringify({ type: 'signup', success: true, id: playerId, username }));
        broadcastPlayers();
        return;
      }

      // Handle login
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
        players[playerId] = players[playerId] || { x: 0, y: 1, z: 0, rotY: 0, username };
        ws.send(JSON.stringify({ type: 'login', success: true, id: playerId, username }));
        broadcastPlayers();
        return;
      }

      // Movement updates (only if logged in)
      if (data.type === 'move' && playerId && data.position) {
        players[playerId] = {
          x: data.position.x,
          y: data.position.y,
          z: data.position.z,
          rotY: data.position.rotY || 0,
          username,
        };
        broadcastPlayers();
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
