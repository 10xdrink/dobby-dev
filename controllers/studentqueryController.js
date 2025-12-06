const StudentQuery = require("../models/StudentQuery");

const cloudinary = require("../config/cloudinary")
const Admin = require("../models/adminLogin")
const { createAndEmitNotification } = require("../helpers/notification");

// Create new query
exports.createQuery = async (req, res) => {
  try {
    const { studentName, email, topic, queryDetails } = req.body;
    let image = null;
    let imagePublicId = null;

    if (req.file) {
      image = req.file.path;            // Cloudinary URL
      imagePublicId = req.file.filename; // Cloudinary Public ID
    }

    const query = await StudentQuery.create({
      studentName,
      email,
      topic,
      queryDetails,
      image,
      imagePublicId
    });

     const admins = await Admin.find().select("_id email");
    const targetUsers = admins.map(admin => ({
      userId: admin._id,
      userModel: "Admin"
    }));

    await createAndEmitNotification({
      title: "New Student Query",
      message: `A new query from "${studentName}" on topic "${topic}" has been submitted.`,
      event: "student-query",
      targetModels: ["Admin"], // Socket.IO real-time
      targetUsers,             // Database for offline Admins
      meta: { queryId: query._id, studentEmail: email }
    });

    res.status(201).json({ success: true, data: query });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get all queries with optional filters
exports.getQueries = async (req, res) => {
  try {
    const { status, topic } = req.query;
    let filter = {};

    if (status && status !== "All") filter.status = status;
    if (topic && topic !== "All") filter.topic = topic;

    const queries = await StudentQuery.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: queries });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update query status (Resolved/Pending)
exports.updateQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentName, email, topic, queryDetails, status } = req.body;

    let query = await StudentQuery.findById(id);
    if (!query) return res.status(404).json({ success: false, message: "Query not found" });

    // Agar new file aayi hai toh purani delete karo
    if (req.file) {
      if (query.imagePublicId) {
        await cloudinary.uploader.destroy(query.imagePublicId);
      }
      query.image = req.file.path;
      query.imagePublicId = req.file.filename;
    }

    if (studentName) query.studentName = studentName;
    if (email) query.email = email;
    if (topic) query.topic = topic;
    if (queryDetails) query.queryDetails = queryDetails;
    if (status) query.status = status;

    await query.save();
    res.status(200).json({ success: true, data: query });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Delete query
exports.deleteQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const query = await StudentQuery.findById(id);
    if (!query) return res.status(404).json({ success: false, message: "Query not found" });

    // Delete image from Cloudinary if exists
    if (query.imagePublicId) {
      await cloudinary.uploader.destroy(query.imagePublicId);
    }

    await query.deleteOne();
    res.status(200).json({ success: true, message: "Query deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
