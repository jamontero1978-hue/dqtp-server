const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// ===============================
// 🌐 Servidor HTTP (Render lo necesita)
// ===============================
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("DQTP WebSocket Server");
});

// ===============================
// 🔌 WebSocket sobre HTTP
// ===============================
const wss = new WebSocket.Server({ server });

// ===============================
// 📦 Salas de partidas
// rooms = { roomId: [ws1, ws2] }
// ===============================
const rooms = {};

// ===============================
// 🤝 Conexión de cliente
// ===============================
wss.on("connection", (ws) => {
  console.log("✅ Cliente conectado");

  ws.on("message", (msg) => {
    let data;

    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.error("❌ Mensaje no válido:", msg);
      return;
    }

    const { room, type } = data;
    if (!room || !type) return;

    // Crear sala si no existe
    if (!rooms[room]) rooms[room] = [];

    // Añadir socket a la sala si no está
    if (!rooms[room].includes(ws)) {
      rooms[room].push(ws);
    }

    // ===============================
    // 🎭 JOIN → asignar rol
    // ===============================
    if (type === "JOIN") {
      console.log(`👋 JOIN a sala ${room}`);

      const players = rooms[room];

      // Máximo 2 jugadores
      if (players.length > 2) {
        ws.send(JSON.stringify({
          type: "ERROR",
          message: "La sala está llena"
        }));
        return;
      }

      // ✅ El primero es Capitán 1, el segundo Capitán 2
      const capNum = players.length === 1 ? 1 : 2;

      console.log(`🎭 Asignando Capitán ${capNum} en sala ${room}`);

      ws.send(JSON.stringify({
        type: "ROLE_ASSIGNED",
        capNum
      }));

      return; // ⬅️ IMPORTANTE: no reenviar JOIN
    }

    // ===============================
    // 🔁 Reenviar mensajes A TODOS
    // (incluido el emisor)
    // ===============================
    rooms[room].forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  // ===============================
  // ❌ Desconexión
  // ===============================
  ws.on("close", () => {
    Object.entries(rooms).forEach(([roomId, list]) => {
      const index = list.indexOf(ws);
      if (index !== -1) {
        list.splice(index, 1);
        console.log(`❌ Cliente desconectado de sala ${roomId}`);
      }

      // Limpieza opcional
      if (list.length === 0) {
        delete rooms[roomId];
      }
    });
  });
});

// ===============================
// 🚀 Arrancar servidor
// ===============================
server.listen(PORT, () => {
  console.log(`🚀 Servidor DQTP activo en el puerto ${PORT}`);
});
