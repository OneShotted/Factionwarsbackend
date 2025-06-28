const WebSocket = require('ws');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

// PostgreSQL connection pool using Supabase DATABASE_URL env var
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase SSL
  },
});

const players = {}; // In-memory player positions keyed by id

// Helper: find user by username
async function findUserByUsername(username) {
  const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows[0];
}

// Helper: create new user
async function createUser(username, password) {
  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();
  await pool.query(
    'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
    [id, username, hashed]
  );
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
        const existingUser = await findUserByUsername(data.username);
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
        const user = await findUserByUsername(data.username);
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

