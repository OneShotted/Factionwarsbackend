const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });
const players = {};

wss.on('connection', (ws) => {
  const id = uuidv4();
  players[id] = { x: 0, y: 1, z: 0 };

  ws.send(JSON.stringify({ type: 'init', id }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'move' && data.position) {
        players[id] = {
  x: data.position.x,
  y: data.position.y,
  z: data.position.z,
  rotY: data.position.rotY || 0
};

        const payload = JSON.stringify({ type: 'update', players });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });

  ws.on('close', () => {
    delete players[id];
    const payload = JSON.stringify({ type: 'update', players });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });
});
