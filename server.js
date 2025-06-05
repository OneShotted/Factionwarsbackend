const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8080 });
const players = {};
const sockets = {};

console.log('Server started on port 8080');

wss.on('connection', (ws) => {
  const id = uuidv4();
  sockets[id] = ws;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error('Invalid JSON:', message);
      return;
    }

    if (data.type === 'register') {
      let name = data.name;
      let isDev = false;
      if (name.includes('#1627')) {
        isDev = true;
        name = name.replace('#1627', '');
      }

      // NEW: read faction from client (default to "red" if missing)
      const faction = data.faction || 'red';

      players[id] = {
        id,
        name,
        x: 0,
        y: 0,
        isDev,
        faction    // store faction in player data
      };

      // Send back the newly assigned id
      ws.send(JSON.stringify({ type: 'id', id }));
      broadcastState();
    }
    else if (data.type === 'leaveGame') {
      delete players[id];
      delete sockets[id];
      broadcastState();
    }
    else if (data.type === 'movementState') {
      if (!players[id]) return;

      const speed = players[id].isDev ? 5 : 2;
      const keys = data.keys || {};

      if (keys.up) players[id].y -= speed;
      if (keys.down) players[id].y += speed;
      if (keys.left) players[id].x -= speed;
      if (keys.right) players[id].x += speed;

      broadcastState();
    }
    else if (data.type === 'chat') {
      const player = players[id];
      if (!player) return;
      const messageToSend = {
        type: 'chat',
        name: player.name,
        message: data.message,
        isBroadcast: false
      };
      broadcast(messageToSend);
    }
    else if (data.type === 'devCommand') {
      const player = players[id];
      if (!player || !player.isDev) return;

      if (data.command === 'kick') {
        const targetId = data.targetId;
        if (players[targetId] && sockets[targetId]) {
          sockets[targetId].send(JSON.stringify({
            type: 'kicked',
            reason: 'You were kicked by a developer.'
          }));
          sockets[targetId].close(4000, 'Kicked by developer');
          delete players[targetId];
          delete sockets[targetId];
          broadcastState();
        }
      }
      else if (data.command === 'teleport') {
        const targetId = data.ta

