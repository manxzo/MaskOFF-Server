const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const Post = require("../models/Post");
const User = require("../models/User");

// Sample job posts data
const sampleJobs = [
  {
    title: "Senior React Developer",
    content:
      "We're looking for a Senior React Developer with 5+ years of experience. Must have strong knowledge of React, TypeScript, and modern frontend frameworks. Remote work available.\n\nRequired Skills:\n- React/Redux\n- TypeScript\n- Node.js\n- REST APIs",
    postType: "job",
  },
  {
    title: "Full Stack JavaScript Engineer",
    content:
      "Fast-growing startup seeks a Full Stack Developer proficient in MERN stack. Join our dynamic team and work on cutting-edge projects.\n\nTech Stack:\n- MongoDB\n- Express.js\n- React\n- Node.js",
    postType: "job",
  },
  {
    title: "Frontend UI/UX Developer",
    content:
      "Looking for a creative Frontend Developer with strong UI/UX skills. Experience with modern design systems and accessibility standards required.\n\nKey Requirements:\n- HTML/CSS/JavaScript\n- Design Systems\n- Responsive Design\n- Accessibility",
    postType: "job",
  },
  {
    title: "Backend Node.js Developer",
    content:
      "Join our backend team to build scalable microservices. Experience with Node.js and MongoDB required.\n\nResponsibilities:\n- API Development\n- Database Design\n- Performance Optimization\n- Security Implementation",
    postType: "job",
  },
  {
    title: "DevOps Engineer",
    content:
      "Seeking a DevOps Engineer to improve our deployment pipeline. Experience with Docker and AWS required.\n\nRequired Experience:\n- CI/CD Pipelines\n- Docker/Kubernetes\n- AWS Services\n- Infrastructure as Code",
    postType: "job",
  },
];

/**
 * Script to generate sample job posts
 * Run with: node query.js
 */
async function generateSamplePosts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find admin user (assuming admin exists)
    const admin = await User.findOne({ username: "admin" });

    if (!admin) {
      console.error("Admin user not found. Please create an admin user first.");
      process.exit(1);
    }

    // Create new job posts
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

// Run the script
generateSamplePosts();
