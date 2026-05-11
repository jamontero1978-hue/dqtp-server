const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

let rooms = {};

wss.on("connection", ws => {
  ws.on("message", msg => {
    const data = JSON.parse(msg);
    const room = data.room;

    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(ws)) rooms[room].push(ws);

    rooms[room].forEach(client => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    Object.values(rooms).forEach(players => {
      const i = players.indexOf(ws);
      if (i !== -1) players.splice(i, 1);
    });
  });
});

console.log("✅ Servidor DQTP activo");
``
