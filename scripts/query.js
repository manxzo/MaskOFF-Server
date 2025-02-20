const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const Post = require("../models/Post");
const User = require("../models/User");

const sampleJobs = [
  {
    title: "Senior React Developer",
    content:
      "looking for a Senior React Developer with 5+ years of experience.",
    postType: "job",
  },
  {
    title: "Full Stack JavaScript Engineer",
    content:
      "Fast-growing startup seeks a Full Stack Developer proficient in MERN stack.",
    postType: "job",
  },
  {
    title: "Frontend UI/UX Developer",
    content:
      "Looking for a creative Frontend Developer with strong UI/UX skills.",
    postType: "job",
  },
  {
    title: "Backend Node.js Developer",
    content:
      "Join our backend team to build scalable microservices.",
    postType: "job",
  },
  {
    title: "DevOps Engineer",
    content:
      "Seeking a DevOps Engineer to improve our deployment pipeline.",
    postType: "job",
  },
];

async function generateSamplePosts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    const admin = await User.findOne({ username: "admin" });
    if (!admin) {
      console.error("Admin user not found. Please create an admin user first.");
      process.exit(1);
    }
    const posts = await Promise.all(
      sampleJobs.map((job) =>
        Post.create({
          ...job,
          author: admin._id,
          createdAt: new Date(),
        })
      )
    );

    console.log(`Added ${posts.length} new sample job posts`);
    console.log("\nSample posts:");
    posts.forEach((post) => {
      console.log(`- ${post.title} (ID: ${post._id})`);
    });
  } catch (error) {
    console.error("Error generating sample posts:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

generateSamplePosts();
