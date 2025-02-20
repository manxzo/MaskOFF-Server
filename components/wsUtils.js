const WebSocket = require("ws");

// Map: userId -> Set of WebSocket connections
const userConnections = new Map();


//  * add connection for specified user
//  @param {string} userId 
//  @param {WebSocket} ws 
function addConnection(userId, ws) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId).add(ws);
}


//  * remove connection for specified user
//   @param {string} userId 
//   @param {WebSocket} ws 
function removeConnection(userId, ws) {
  if (userConnections.has(userId)) {
    userConnections.get(userId).delete(ws);
    if (userConnections.get(userId).size === 0) {
      userConnections.delete(userId);
    }
  }
}


//  * send JSON message only to specified user
//  * @param {string} userId 
//  * @param {Object} data 
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

//  * send JSON message to multiple user
//  * @param {string[]} userIds
//  * @param {Object} data
function sendToUsers(userIds, data) {
  userIds.forEach((userId) => {
    sendToUser(userId, data);
  });
}

//  * broadcast a JSON message to all connected users
//  * @param {Object} data 
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
        // expect authentication message to assign userId to connection
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
