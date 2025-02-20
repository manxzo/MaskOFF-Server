const WebSocket = require("ws");
const userConnections = new Map();
function addConnection(userId, ws) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId).add(ws);
}
function removeConnection(userId, ws) {
  if (userConnections.has(userId)) {
    userConnections.get(userId).delete(ws);
    if (userConnections.get(userId).size === 0) {
      userConnections.delete(userId);
    }
  }
}
function sendToUser(userId, data) {
  const message = JSON.stringify(data);
  if (userConnections.has(userId)) {
    for (const ws of userConnections.get(userId)) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}
function sendToUsers(userIds, data) {
  userIds.forEach((userId) => {
    sendToUser(userId, data);
  });
}

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const connections of userConnections.values()) {
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

function setupWebSocketServer(wss) {
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection established.");

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "AUTH" && data.userId) {
          ws.userId = data.userId;
          addConnection(data.userId, ws);
          console.log(`WebSocket authenticated for user: ${data.userId}`);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    });

    ws.on("close", () => {
      if (ws.userId) {
        removeConnection(ws.userId, ws);
        console.log(`WebSocket connection closed for user: ${ws.userId}`);
      }
    });
  });
}

module.exports = {
  setupWebSocketServer,
  sendToUser,
  sendToUsers,
  broadcast,
};
