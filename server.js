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
// 📦 Salas de partidas con ESTADO
// rooms = {
//   roomId: {
//     clients: [ws1, ws2],
//     state: {
//       phase: "WAITING" | "SETUP" | "CAPTAINS",
//       goalsLimit: number | null
//     }
//   }
// }
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
    } catch {
      console.error("❌ Mensaje inválido");
      return;
    }

    const { room, type } = data;
    if (!room || !type) return;

    // ===============================
    // 🏗️ Crear sala si no existe
    // ===============================
    if (!rooms[room]) {
      rooms[room] = {
        clients: [],
        state: {
          phase: "WAITING",
          goalsLimit: null
        }
      };
      console.log(`🆕 Sala creada: ${room}`);
    }

    const roomObj = rooms[room];

    // Añadir socket a la sala si no está
    if (!roomObj.clients.includes(ws)) {
      roomObj.clients.push(ws);
    }

    // ===============================
    // 🎭 JOIN → asignar rol + sincronizar estado
    // ===============================
    if (type === "JOIN") {
      const players = roomObj.clients;

      if (players.length > 2) {
        ws.send(JSON.stringify({
          type: "ERROR",
          message: "La sala está llena"
        }));
        return;
      }

      const capNum = players.length === 1 ? 1 : 2;
      console.log(`🎭 Capitán ${capNum} asignado en sala ${room}`);

      ws.send(JSON.stringify({
        type: "ROLE_ASSIGNED",
        capNum
      }));

      // ✅ SINCRONIZAR ESTADO ACTUAL DE LA PARTIDA
      ws.send(JSON.stringify({
        type: "SYNC_STATE",
        phase: roomObj.state.phase,
        goalsLimit: roomObj.state.goalsLimit
      }));

      return; // ⛔ No reenviar JOIN
    }

    // ===============================
    // 🧠 ACTUALIZAR ESTADO DE PARTIDA
    // ===============================
    if (type === "SET_GOALS") {
      roomObj.state.phase = "CAPTAINS";
      roomObj.state.goalsLimit = data.value;
      console.log(`⚽ Sala ${room} → goles = ${data.value}`);
    }

    // (futuro: aquí puedes añadir TEAMS, DRAFT, GAME, etc.)

    // ===============================
    // 🔁 REENVIAR A TODOS (INCLUYE EMISOR)
    // ===============================
    roomObj.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  // ===============================
  // ❌ Desconexión
  // ===============================
  ws.on("close", () => {
    Object.entries(rooms).forEach(([roomId, roomObj]) => {
      const idx = roomObj.clients.indexOf(ws);
      if (idx !== -1) {
        roomObj.clients.splice(idx, 1);
        console.log(`❌ Desconectado de sala ${roomId}`);
      }

      // Limpieza automática de sala vacía
      if (roomObj.clients.length === 0) {
        delete rooms[roomId];
        console.log(`🧹 Sala eliminada: ${roomId}`);
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
