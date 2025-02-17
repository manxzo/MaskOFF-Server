// wsUtils.js
const sendToUser = (wss, userId, data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN && client.userId === userId) {
        client.send(JSON.stringify(data));
      }
    });
  };
  
  module.exports = { sendToUser };
  