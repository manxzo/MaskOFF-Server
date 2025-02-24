const WebSocket = require("ws");

let wss = null;
// mapping userID to their connected WS instance
// (in a production system & future, might want to support multiple sockets per user)
const userSockets = {};

/**
 * sets up the WS server by listening for new connections
 * when client connects, it expects a initial JSON message of the form:
 *   { type: "AUTH", userID: "..." }
 * this maps the userID to the WS for sending targeted notifications
 *
 * @param {WebSocket.Server} wsServer - WS server instance
 */
const setupWebSocketServer = (wsServer) => {
  wss = wsServer;
  wsServer.on("connection", (ws, req) => {
    console.log("New WebSocket connection from", req.socket.remoteAddress);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "AUTH" && data.userID) {
          // map the authenticated userID to this WS connection
          userSockets[data.userID] = ws;
          console.log(`User ${data.userID} authenticated on WebSocket`);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    });

    ws.on("close", () => {
      // remove this socket from our mapping
      for (const userID in userSockets) {
        if (userSockets[userID] === ws) {
          delete userSockets[userID];
          console.log(`WebSocket for user ${userID} disconnected`);
          break;
        }
      }
    });
  });
};

/**
 * sends JSON payload to connected client identified by userID
 *
 * @param {String} userID - user's unique identifier.
 * @param {Object} payload - JSON payload to send
 */
const sendToUser = (userID, payload) => {
  const socket = userSockets[userID];
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

/**
 * sends JSON payload to multiple userIDs
 *
 * @param {Array<String>} userIDs - array of user IDs
 * @param {Object} payload - JSON payload to send
 */
const sendToUsers = (userIDs, payload) => {
  userIDs.forEach((userID) => {
    sendToUser(userID, payload);
  });
};
const sendToAll = (payload) => {
  Object.keys(userSockets).forEach((userID) => {
    sendToUser(userID, payload);
  });
};
module.exports = { setupWebSocketServer, sendToUser, sendToUsers,sendToAll };
