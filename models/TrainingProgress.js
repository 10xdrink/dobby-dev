const mongoose = require("mongoose");

const trainingProgressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  trainingId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentTraining", required: true },
  watchedSeconds: { type: Number, default: 0 },
  videoDuration: { type: Number, default: 0 },
  percentWatched: { type: Number, default: 0 },
  isCompleted: { type: Boolean, default: false },
  lastWatchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TrainingProgress", trainingProgressSchema);
