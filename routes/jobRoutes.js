const express = require("express");
const router = express.Router();
const Job = require("../models/Job");
const UserProfile = require("../models/UserProfile");
const { verifyToken } = require("../components/jwtUtils");
const JobApplication = require("../models/JobApplication");
const { sendToAll } = require("../components/wsUtils");
// create new job
router.post("/jobs", verifyToken, async (req, res) => {
  try {
    const { title, description, price, contractPeriod } = req.body;

    if (!title || !description || !price || !contractPeriod) {
      return res.status(400).json({
        error: "Title, description, price, and contract period are required.",
      });
    }

    const newJob = new Job({
      user: req.user.id,
      title,
      description,
      price,
      contractPeriod,
    });

    await newJob.save();

    // populate user data before sending response
    const populatedJob = await Job.findById(newJob._id).populate(
      "user",
      "username"
    );
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.status(201).json({
      message: "Job created successfully.",
      job: populatedJob.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get all jobs with user profile info
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await Job.find().populate("user", "username");

    const jobsWithProfile = await Promise.all(
      jobs.map(async (job) => {
        // added null check for job.user so the server doesn't crash if the user is deleted
        if (!job.user) {
          return {
            ...job.toJSON(),
            user: {
              userID: null,
              username: "Unknown User",
              publicInfo: {},
            },
          };
        }

        const profile = await UserProfile.findOne({ user: job.user._id });
        return {
          ...job.toJSON(),
          user: {
            userID: job.user._id,
            username: job.user.username || "Unknown User",
            publicInfo: profile ? profile.publicInfo : {},
          },
        };
      })
    );
  
    res.json({ jobs: jobsWithProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get 1 job by jobID
router.get("/jobs/:jobID", async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobID).populate(
      "user",
      "username"
    );

    if (!job) return res.status(404).json({ error: "Job not found." });

    const profile = await UserProfile.findOne({ user: job.user._id });
   
    res.json({
      job: {
        ...job.toJSON(),
        user: {
          userID: job.user._id,
          username: job.user.username,
          publicInfo: profile ? profile.publicInfo : {},
        },
      },
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// update job
router.put("/jobs/:jobID", verifyToken, async (req, res) => {
  try {
    const { jobID } = req.params;
    const { title, description, price, contractPeriod, isComplete } = req.body;

    const job = await Job.findById(jobID);
    if (!job) return res.status(404).json({ error: "Job not found." });

    // check if user owns the job
    if (job.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this job." });
    }

    // update fields if provided
    if (title) job.title = title;
    if (description) job.description = description;
    if (price) job.price = price;
    if (contractPeriod) job.contractPeriod = contractPeriod;
    if (typeof isComplete !== "undefined") job.isComplete = isComplete;

    await job.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Job updated", job: job.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete job
router.delete("/jobs/:jobID", verifyToken, async (req, res) => {
  try {
    const { jobID } = req.params;
    const job = await Job.findById(jobID);

    if (!job) return res.status(404).json({ error: "Job not found." });

    // check if user owns the job
    if (job.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this job." });
    }

    await Job.findByIdAndDelete(jobID);
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.json({ message: "Job deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get jobs by user
router.get("/users/:userID/jobs", async (req, res) => {
  try {
    const { userID } = req.params;
    const jobs = await Job.find({ user: userID }).populate("user", "username");

    const profile = await UserProfile.findOne({ user: userID });

    const jobsWithProfile = jobs.map((job) => ({
      ...job.toJSON(),
      user: {
        userID: job.user._id,
        username: job.user.username,
        publicInfo: profile ? profile.publicInfo : {},
      },
    }));

    res.json({ jobs: jobsWithProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit application
router.post("/jobs/:jobID/apply", verifyToken, async (req, res) => {
  try {
    const { jobID } = req.params;
    const { message } = req.body;

    // Check if job exists
    const job = await Job.findById(jobID);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Check if user already applied
    const existingApplication = await JobApplication.findOne({
      job: jobID,
      applicant: req.user.id,
    });
    if (existingApplication) {
      return res.status(400).json({ error: "Already applied to this job" });
    }

    const application = new JobApplication({
      job: jobID,
      applicant: req.user.id,
      message,
    });

    await application.save();
    sendToAll({
      type: "UPDATE_DATA",
      update: "refresh",
    })
    res.status(201).json({
      message: "Application submitted successfully",
      application: application.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get applications for a job (job author only)
router.get("/jobs/:jobID/applications", verifyToken, async (req, res) => {
  try {
    const { jobID } = req.params;

    // Check if job exists and user is author
    const job = await Job.findById(jobID);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (job.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const applications = await JobApplication.find({ job: jobID })
      .populate({
        path: "applicant",
        select: "username name _id", // Include _id for userID
      })
      .sort("-createdAt");

    // Transform the populated data to match the expected format
    const formattedApplications = applications.map((app) => ({
      applicationID: app._id,
      status: app.status,
      message: app.message,
      createdAt: app.createdAt,
      applicant: {
        userID: app.applicant._id,
        username: app.applicant.username,
        name: app.applicant.name,
      },
    }));

    res.json({ applications: formattedApplications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update application status (job author only)
router.put(
  "/jobs/:jobID/applications/:applicationID",
  verifyToken,
  async (req, res) => {
    try {
      const { jobID, applicationID } = req.params;
      const { status } = req.body;

      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Check if job exists and user is author
      const job = await Job.findById(jobID);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.user.toString() !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const application = await JobApplication.findByIdAndUpdate(
        applicationID,
        { status },
        { new: true }
      ).populate("applicant", "username name");

      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      sendToAll({
        type: "UPDATE_DATA",
        update: "refresh",
      })
      res.json({ application });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
