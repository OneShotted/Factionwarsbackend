const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });
const players = {};

wss.on('connection', (ws) => {
  const id = uuidv4();

  // Temporary player entry (will be updated when username is sent)
  players[id] = {
    x: 0,
    y: 1,
    z: 0,
    rotY: 0,
    username: 'Unnamed'
  };

  // Send init ID to client
  ws.send(JSON.stringify({ type: 'init', id }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Username setup
      if (data.type === 'join' && typeof data.username === 'string') {
        players[id].username = data.username;
      }

      // Position and rotation update
      if (data.type === 'move' && data.position) {
        players[id] = {
          ...players[id],
          x: data.position.x,
          y: data.position.y,
          z: data.position.z,
          rotY: data.position.rotY || 0
        };

        // Broadcast updated player data to all clients
        const payload = JSON.stringify({
          type: 'update',
          players
        });

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }

      // Chat message
      if (data.type === 'chat' && typeof data.text === 'string') {
        const chatMessage = {
          type: 'chat',
          username: players[id]?.username || 'Unnamed',
          text: data.text
        };

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(chatMessage));
          }
        });
      }

    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    delete players[id];

    const payload = JSON.stringify({
      type: 'update',
      players
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });
});



