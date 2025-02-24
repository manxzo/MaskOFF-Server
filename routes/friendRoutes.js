const express = require("express");
const router = express.Router();
const UserAuth = require("../models/UserAuth");
const { verifyToken } = require("../components/jwtUtils");
const { sendToUsers } = require("../components/wsUtils");


 //sending friend request:
 router.post("/friends/request", verifyToken, async (req, res) => {
  try {
    const { friendID } = req.body;
    const sender = await UserAuth.findById(req.user.id);
    const recipient = await UserAuth.findById(friendID);
    if (!recipient)
      return res.status(404).json({ error: "Recipient not found." });

   
    if (
      sender.friendRequestsSent.some((fr) => fr.userID.toString() === friendID)
    ) {
      return res.status(400).json({ error: "Friend request already sent." });
    }

   
    sender.friendRequestsSent.push({
      userID: recipient._id,
      username: recipient.username,
    });

    recipient.friendRequestsReceived.push({
      userID: sender._id,
      username: sender.username,
    });
    await sender.save();
    await recipient.save();

   
    sendToUsers([friendID,sender._id], { type: "UPDATE_DATA", update: "user" });
    res.json({ message: "Friend request sent." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); 


// list friend requests received 
router.get("/friends/requests/received", verifyToken, async (req, res) => {
  try {
    const user = await UserAuth.findById(req.user.id);
    res.json({ friendRequestsReceived: user.friendRequestsReceived });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// list friend requests sent 
router.get("/friends/requests/sent", verifyToken, async (req, res) => {
  try {
    const user = await UserAuth.findById(req.user.id);
    res.json({ friendRequestsSent: user.friendRequestsSent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//accept friend request:
router.post("/friends/accept", verifyToken, async (req, res) => {
  try {
    const { friendID } = req.body;
    const currentUser = await UserAuth.findById(req.user.id);
    const sender = await UserAuth.findById(friendID);
    if (!sender) return res.status(404).json({ error: "Sender not found." });

    
    currentUser.friendRequestsReceived =
      currentUser.friendRequestsReceived.filter(
        (fr) => fr.userID.toString() !== friendID
      );
    
    sender.friendRequestsSent = sender.friendRequestsSent.filter(
      (fr) => fr.userID.toString() !== currentUser._id.toString()
    );

    
    const alreadyFriends = currentUser.friends.some(
      (f) => f.userID.toString() === friendID
    );
    if (!alreadyFriends) {
      currentUser.friends.push({
        userID: sender._id,
        username: sender.username,
      });
      sender.friends.push({
        userID: currentUser._id,
        username: currentUser.username,
      });
    }

    await currentUser.save();
    await sender.save();

   
    sendToUsers([req.user.id, friendID], {
      type: "UPDATE_DATA",
      update: "user",
    });
    res.json({ message: "Friend request accepted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//reject friend request:
router.post("/friends/reject", verifyToken, async (req, res) => {
  try {
    const { friendID } = req.body;
    const currentUser = await UserAuth.findById(req.user.id);
    const sender = await UserAuth.findById(friendID);
    if (!sender) return res.status(404).json({ error: "Sender not found." });

    currentUser.friendRequestsReceived =
      currentUser.friendRequestsReceived.filter(
        (fr) => fr.userID.toString() !== friendID
      );
    sender.friendRequestsSent = sender.friendRequestsSent.filter(
      (fr) => fr.userID.toString() !== currentUser._id.toString()
    );

    await currentUser.save();
    await sender.save();
    sendToUsers([req.user.id, friendID], {
      type: "UPDATE_DATA",
      update: "user",
    });
    res.json({ message: "Friend request rejected." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// current user friend list
router.get("/friends", verifyToken, async (req, res) => {
  try {
    const user = await UserAuth.findById(req.user.id);
    res.json({ friends: user.friends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
