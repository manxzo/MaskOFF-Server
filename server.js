require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const morgan = require("morgan");
const WebSocket = require("ws");
const http = require("http");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(morgan("combined"));

// View engine setup
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});
app.use(limiter);

// Routes


// Import and use API routes
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on("connected", () => {
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);
});
mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

// Create the WebSocket server (after creating the HTTP server)
const wss = new WebSocket.Server({ server });

// When a client connects...
wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message);

      // Listen for an authentication message
      if (parsed.type === "AUTH" && parsed.userId) {
        ws.userId = parsed.userId;
        console.log(`WebSocket authenticated for user: ${ws.userId}`);
      }
      // Additional WS message handling can be added here.
    } catch (err) {
      console.error("Error parsing WS message:", err);
    }
  });

  // Optionally, send a welcome message.
  ws.send(JSON.stringify({ type: "WELCOME", message: "Welcome to the MaskOFF WS server" }));
});

// WebSocket helper to send live updates to a user.
const sendToUser = (userId, data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(JSON.stringify(data));
    }
  });
};

// Expose sendToUser for use in other modules (e.g., API routes)
module.exports.sendToUser = sendToUser;

// Root & API info endpoints
app.get("/", (req, res) => {
  res.json({ message: "Welcome to MaskOFF" });
});

app.get("/api", (req, res) => {
  res.json({
    endpoints: {
      register: "POST /api/newuser",
      login: "POST /api/users/login",
      getUser: "GET /api/user/:userID",
      listUsers: "GET /api/users",
      friendRequest: "POST /api/friends/request",
      friendRequests: "GET /api/friends/requests",
      deleteFriendRequest: "DELETE /api/friends/request",
      acceptFriend: "POST /api/friends/accept",
      friends: "GET /api/friends",
      createChat: "POST /api/chat/create",
      listChats: "GET /api/chats",
      findChats: "GET /api/chat/:userId",
      sendMessage: "POST /api/chat/send",
      getMessages: "GET /api/chat/messages/:chatId",
      deleteMessage: "DELETE /api/chat/message/:chatId/:messageId",
      editMessage: "PUT /api/chat/message/:chatId/:messageId",
      deleteChat: "DELETE /api/chat/:chatId",
    },
  });
});
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
