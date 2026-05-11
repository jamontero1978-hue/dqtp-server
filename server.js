const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// 1️⃣ Servidor HTTP básico (Render lo necesita)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("DQTP WebSocket Server");
});

// 2️⃣ WebSocket SOBRE el servidor HTTP
const wss = new WebSocket.Server({ server });

let rooms = {};

wss.on("connection", ws => {
  console.log("✅ Cliente conectado");

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    const { room, type } = data;

    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(ws)) rooms[room].push(ws);

    if (type === "JOIN") {
      console.log(`👋 JOIN a sala ${room}`);
      return;
    }

    // 🔁 Reenviar a los demás
    rooms[room].forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    Object.values(rooms).forEach(list => {
      const i = list.indexOf(ws);
      if (i !== -1) list.splice(i, 1);
    });
    console.log("❌ Cliente desconectado");
  });
});

// 3️⃣ INICIAR SERVER CORRECTAMENTE PARA RENDER
server.listen(PORT, () => {
  console.log(`🚀 Servidor DQTP activo en puerto ${PORT}`);
});
``
