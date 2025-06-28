const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

const usersFilePath = path.join(__dirname, 'users.json');

// Load users from file or initialize empty object
let users = {};
try {
  const data = fs.readFileSync(usersFilePath, 'utf8');
  users = JSON.parse(data);
  console.log(`Loaded ${Object.keys(users).length} user(s) from users.json`);
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('users.json not found, starting with empty users list');
  } else {
    console.error('Error reading users.json:', err);
  }
}

function saveUsersToFile() {
  fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), (err) => {
    if (err) console.error('Error writing users.json:', err);
  });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const players = {};

wss.on('connection', (ws) => {
  let loggedIn = false;
  let playerId = null;
  let username = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'signup') {
        const { username: newUsername, password } = data;
        if (!newUsername || !password) {
          ws.send(JSON.stringify({ type: 'signupError', message: 'Username and password required.' }));
          return;
        }
        if (users[newUsername]) {
          ws.send(JSON.stringify({ type: 'signupError', message: 'Username already taken.' }));
          return;
        }
        // Save new user in memory and file
        users[newUsername] = {
          passwordHash: hashPassword(password),
          id: uuidv4(),
        };
        saveUsersToFile();
        ws.send(JSON.stringify({ type: 'signupSuccess', message: 'Account created! Please log in.' }));
        return;
      }

      if (data.type === 'login') {
        const { username: loginUsername, password } = data;
        if (!loginUsername || !password) {
          ws.send(JSON.stringify({ type: 'loginError', message: 'Username and password required.' }));
          return;
        }
        const user = users[loginUsername];
        if (!user) {
          ws.send(JSON.stringify({ type: 'loginError', message: 'Invalid username or password.' }));
          return;
        }
        if (user.passwordHash !== hashPassword(password)) {
          ws.send(JSON.stringify({ type: 'loginError', message: 'Invalid username or password.' }));
          return;
        }

        loggedIn = true;
        playerId = user.id;
        username = loginUsername;

        if (!players[playerId]) {
          players[playerId] = {
            ws,
            username,
            position: { x: 0, y: 1, z: 0, rotY: 0 },
          };
        } else {
          players[playerId].ws = ws;
        }

        ws.send(JSON.stringify({ type: 'loginSuccess', id: playerId, username }));

        broadcastPlayers();

        return;
      }

      if (data.type === 'move') {
        if (!loggedIn) return;

        if (data.position) {
          players[playerId].position = {
            x: data.position.x,
            y: data.position.y,
            z: data.position.z,
            rotY: data.position.rotY || 0,
          };
          broadcastPlayers();
        }
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });

  ws.on('close', () => {
    if (loggedIn && playerId && players[playerId]) {
      delete players[playerId];
      broadcastPlayers();
    }
  });

  function broadcastPlayers() {
    const payload = {
      type: 'update',
      players: {},
    };
    for (const [id, player] of Object.entries(players)) {
      payload.players[id] = {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rotY: player.position.rotY,
        username: player.username,
      };
    }
    const msg = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
});

console.log(`WebSocket server running on port ${process.env.PORT || 3000}`);
