const StudentTraining = require("../models/TrainingInfo")
const { createAndEmitNotification } = require("../helpers/notification");
const cloudinary = require("../config/cloudinary");


exports.createTraining = async (req, res) => {
    try {
        const { title, description } = req.body;
        const thumbnail = req.files?.thumbnail?.[0];
        const video = req.files?.video?.[0];

        const newTraining = new StudentTraining({
            title,
            description,
            thumbnailUrl: thumbnail ? thumbnail.path : null,
            thumbnailPublicId: thumbnail ? thumbnail.filename : null,
            videoUrl: video ? video.path : null,
            videoPublicId: video ? video.filename : null,
        });

        await newTraining.save();

       

        res.status(201).json(newTraining);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get published trainings
exports.getPublishedTrainings = async (req, res) => {
    try {
        const trainings = await StudentTraining.find({ published: true }).sort({ createdAt: -1 });
        res.status(200).json(trainings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all trainings (published + unpublished)
exports.getAllTrainings = async (req, res) => {
    try {
        const trainings = await StudentTraining.find().sort({ createdAt: -1 });
        res.status(200).json(trainings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// Update a training by ID (delete old + upload new)
exports.updateTraining = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, published } = req.body;

        const training = await StudentTraining.findById(id);
        if (!training) return res.status(404).json({ message: "Training not found" });

        // delete + update thumbnail
        if (req.files?.thumbnail?.[0]) {
            if (training.thumbnailPublicId) {
                await cloudinary.uploader.destroy(training.thumbnailPublicId);
            }
            training.thumbnailUrl = req.files.thumbnail[0].path;
            training.thumbnailPublicId = req.files.thumbnail[0].filename;
        }

        // delete + update video
        if (req.files?.video?.[0]) {
            if (training.videoPublicId) {
                await cloudinary.uploader.destroy(training.videoPublicId, { resource_type: "video" });
            }
            training.videoUrl = req.files.video[0].path;
            training.videoPublicId = req.files.video[0].filename;
        }

        // update other fields
        if (title) training.title = title;
        if (description) training.description = description;
        if (typeof published !== "undefined") training.published = published;

        await training.save();

        res.status(200).json(training);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a training by ID (remove from Cloudinary also)
exports.deleteTraining = async (req, res) => {
    try {
        const { id } = req.params;

        const training = await StudentTraining.findById(id);
        if (!training) return res.status(404).json({ message: "Training not found" });

        if (training.thumbnailPublicId) {
            await cloudinary.uploader.destroy(training.thumbnailPublicId);
        }
        if (training.videoPublicId) {
            await cloudinary.uploader.destroy(training.videoPublicId, { resource_type: "video" });
        }

        await training.deleteOne();

        res.status(200).json({ message: "Training deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
