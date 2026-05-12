const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

// ===============================
// 🌐 Servidor HTTP (Render)
// ===============================
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("DQTP WebSocket Server");
});

// ===============================
// 🔌 WebSocket
// ===============================
const wss = new WebSocket.Server({ server });

// ===============================
// 📦 Salas con estado AUTORITATIVO
// ===============================
const rooms = {};

// ===============================
// 🤝 Conexión
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
    // 🏗️ Crear sala
    // ===============================
    if (!rooms[room]) {
      rooms[room] = {
        clients: [],
        state: {
          phase: "WAITING",
          goalsLimit: null,
          captains: {
            1: { name: null, ready: false },
            2: { name: null, ready: false }
          },
          // ✅ ESTADO DE DRAFT (CLAVE)
          draft: {
            system: null,
            picks: []
          }
        }
      };
      console.log(`🆕 Sala creada: ${room}`);
    }

    const roomObj = rooms[room];

    // Añadir cliente a la sala si no está
    if (!roomObj.clients.includes(ws)) {
      roomObj.clients.push(ws);
    }

    // ===============================
    // 🎭 JOIN
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

      ws.send(JSON.stringify({
        type: "ROLE_ASSIGNED",
        capNum
      }));

      // ✅ SINCRONIZACIÓN COMPLETA
      ws.send(JSON.stringify({
        type: "SYNC_STATE",
        phase: roomObj.state.phase,
        goalsLimit: roomObj.state.goalsLimit,
        captains: roomObj.state.captains
      }));

      console.log(`🎭 Capitán ${capNum} unido a sala ${room}`);
      return;
    }

    // ===============================
    // ⚽ SET_GOALS
    // ===============================
    if (type === "SET_GOALS") {
      roomObj.state.goalsLimit = data.value;
      roomObj.state.phase = "CAPTAINS";
      console.log(`⚽ Sala ${room} → goles = ${data.value}`);
    }

    // ===============================
    // 👤 SET_CAPTAIN_NAME
    // ===============================
    if (type === "SET_CAPTAIN_NAME") {
      const cap = data.capNum;

      roomObj.state.captains[cap].name = data.name;
      roomObj.state.captains[cap].ready = true;

      const c1Ready = roomObj.state.captains[1].ready;
      const c2Ready = roomObj.state.captains[2].ready;

      if (c1Ready && c2Ready) {
        roomObj.state.phase = "TEAMS";
        console.log(`✅ Ambos capitanes listos en sala ${room}`);
      }
    }

    // ===============================
    // 🧩 SET_DRAFT_SYSTEM
    // ===============================
    if (type === "SET_DRAFT_SYSTEM") {
      roomObj.state.phase = "DRAFT";
      roomObj.state.draft.system = data.system;
      roomObj.state.draft.picks = [];
      console.log(`🧩 Draft iniciado en sala ${room} con sistema ${data.system}`);
    }

    // ===============================
    // 🎯 DRAFT_PICK (ARREGLO CLAVE)
    // ===============================
    if (type === "DRAFT_PICK") {
      const { playerId, targetTeamNum } = data;

      // ❌ Evitar picks duplicados
      if (roomObj.state.draft.picks.some(p => p.playerId === playerId)) {
        console.warn(`⛔ Pick duplicado ignorado en sala ${room}: ${playerId}`);
        return;
      }

      // ✅ Registrar pick como OFICIAL
      roomObj.state.draft.picks.push({
        playerId,
        targetTeamNum
      });

      console.log(`✅ Draft pick aceptado en sala ${room}: ${playerId}`);
      console.log(`📊 Total picks: ${roomObj.state.draft.picks.length}`);
    }

    // ===============================
    // 🔁 Reenviar a TODOS
    // ===============================
    roomObj.clients.forEach((client) => {
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
        console.log(`❌ Cliente desconectado de sala ${roomId}`);
      }

      if (roomObj.clients.length === 0) {
        delete rooms[roomId];
        console.log(`🧹 Sala eliminada: ${roomId}`);
      }
    });
  });
});

// ===============================
// 🚀 Arranque
// ===============================
server.listen(PORT, () => {
  console.log(`🚀 Servidor DQTP activo en puerto ${PORT}`);
});
