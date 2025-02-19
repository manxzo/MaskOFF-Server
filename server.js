// [server.js]
// Main entry point for MaskOFF-Server

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
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);
const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

// Import and use post routes
const postRoutes = require("./routes/posts");
app.use("/api", postRoutes);

// Import and use introduction routes
const introductionRoutes = require("./routes/introductions");
app.use("/api", introductionRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on("connected", () => {
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);
});
mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

// Create WebSocket server and attach it to the HTTP server.
const wss = new WebSocket.Server({ server });
app.locals.wss = wss; // (optional if you need it in routes)
const { setupWebSocketServer } = require("./components/wsUtils");
setupWebSocketServer(wss);

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
      createPost: "POST /api/posts",
      getPosts: "GET /api/posts",
      getPost: "GET /api/posts/:postId",
      updatePost: "PUT /api/posts/:postId",
      deletePost: "DELETE /api/posts/:postId",
      createIntroduction: "POST /api/introduction",
      getIntroductions: "GET /api/introductions",
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
