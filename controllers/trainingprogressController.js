const TrainingProgress = require("../models/TrainingProgress");

exports.updateProgress = async (req, res) => {
  try {

    console.log("Incoming Progress Data:", req.body);

   if (!req.user || !(req.user._id || req.user.id)) {
  return res.status(401).json({ message: "Authentication required." });
}
const studentId = req.user._id || req.user.id;

    const { trainingId, watchedSeconds, videoDuration } = req.body;

    if (!trainingId || !videoDuration)
      return res.status(400).json({ message: "Missing trainingId or videoDuration" });

    if (Number(videoDuration) === 0) { 
        console.error("Error: videoDuration cannot be zero");
        return res.status(400).json({ message: "videoDuration cannot be zero" });
    }

   
const rawPercent = Number((watchedSeconds / videoDuration) * 100).toFixed(2);
const percentWatched = Math.min(100, parseFloat(rawPercent)); 

    console.log("Calculated Percent:", percentWatched);
    const isCompleted = percentWatched >= 90;

  const progress = await TrainingProgress.findOneAndUpdate(
  { studentId, trainingId },
  {
    $max: { watchedSeconds },
    $set: {
      videoDuration,
      percentWatched,
      isCompleted,
      lastWatchedAt: new Date(),
    },
  },
  { upsert: true, new: true }
);


    res.json(progress);
  } catch (error) {
    console.error("CRITICAL 500 ERROR IN updateProgress:", error.message, error.stack);
    res.status(500).json({ message: error.message });
  }
};


exports.getProgress = async (req, res) => {
  try {

    if (!req.user || !(req.user._id || req.user.id)) {
  return res.status(401).json({ message: "Authentication required." });
}


    const { trainingId } = req.params;
  const studentId = req.user._id || req.user.id;
    const progress = await TrainingProgress.findOne({ studentId, trainingId });
    res.json(progress || { watchedSeconds: 0, percentWatched: 0 });
  } catch (error) {
    console.error("CRITICAL 500 ERROR IN getProgress:", error.message, error.stack);
    res.status(500).json({ message: error.message });
  }
};


