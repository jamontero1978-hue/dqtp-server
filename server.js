const http = require("http");
const WebSocket = require("ws");
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("DQTP WebSocket Server");
});
const wss = new WebSocket.Server({ server });
const rooms = {};
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
    // Crear sala si no existe
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
          teams: [],
          convocados: null,
          draft: {
            system: null,
            step: 0,
            currentCap: null,
            picks: []
          }
        }
      };
      console.log(`🆕 Sala creada: ${room}`);
    }
    const roomObj = rooms[room];
    // Añadir cliente a la sala
    if (!roomObj.clients.includes(ws)) {
      roomObj.clients.push(ws);
    }
    // JOIN
    if (type === "JOIN") {
      const capNum = roomObj.clients.length === 1 ? 1 : 2;
      ws.send(JSON.stringify({
        type: "ROLE_ASSIGNED",
        capNum
      }));
      ws.send(JSON.stringify({
        type: "SYNC_STATE",
        phase: roomObj.state.phase,
        goalsLimit: roomObj.state.goalsLimit,
        captains: roomObj.state.captains,
        teams: roomObj.state.teams,
        convocados: roomObj.state.convocados,
        draft: roomObj.state.draft
      }));
      console.log(`🎭 Capitán ${capNum} unido a sala ${room}`);
      return;
    }
    // SET GOALS
    if (type === "SET_GOALS") {
      roomObj.state.goalsLimit = data.value;
      roomObj.state.phase = "CAPTAINS";
      console.log(`⚽ Sala ${room} → goles = ${data.value}`);
    }
    // SET CAPTAIN NAME
    if (type === "SET_CAPTAIN_NAME") {
      const cap = data.capNum;
      roomObj.state.captains[cap].name = data.name;
      roomObj.state.captains[cap].ready = true;
      if (roomObj.state.captains[1].ready && roomObj.state.captains[2].ready) {
        roomObj.state.phase = "TEAMS";
        console.log(`✅ Ambos capitanes listos en sala ${room}`);
      }
    }
    // PICK TEAM
    if (type === "PICK_TEAM") {
      roomObj.state.teams.push({ name: data.name, color: data.color });
      if (roomObj.state.teams.length === 2) {
        roomObj.state.phase = "CONVOCATORIA";
      }
    }
    // SET CONVOCADOS
    if (type === "SET_CONVOCADOS") {
      roomObj.state.convocados = data.convocados;
      console.log(`📋 Convocados guardados en sala ${room}`);
    }
    // SET DRAFT SYSTEM
    if (type === "SET_DRAFT_SYSTEM") {
      roomObj.state.phase = "DRAFT";
      roomObj.state.draft.system = data.system;
      roomObj.state.draft.step = 0;
      roomObj.state.draft.currentCap = (data.system === 'B') ? 2 : 1;
      roomObj.state.draft.picks = [];
      console.log(`🧩 Draft iniciado en sala ${room} (${data.system})`);
    }
    // DRAFT PICK
    if (type === "DRAFT_PICK") {
      const { playerId, targetTeamNum } = data;
      if (roomObj.state.draft.picks.some(p => p.playerId === playerId)) {
        console.warn(`⛔ Pick duplicado ignorado: ${playerId}`);
        return;
      }
      roomObj.state.draft.picks.push({ playerId, targetTeamNum });
      roomObj.state.draft.step++;
      // Avanzar turno (sistemas A, C, D)
      if (roomObj.state.draft.system !== 'B') {
        const sequence = [1, 2, 2, 1, 1, 2, 2, 1, 1, 2];
        const nextStep = roomObj.state.draft.step;
        if (nextStep < sequence.length) {
          roomObj.state.draft.currentCap = sequence[nextStep];
        }
      }
      console.log(`✅ Draft pick: ${playerId} → equipo ${targetTeamNum}`);
    }
    // BROADCAST A TODOS MENOS AL EMISOR
    roomObj.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });
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
server.listen(PORT, () => {
  console.log(`🚀 Servidor DQTP activo en puerto ${PORT}`);
});
