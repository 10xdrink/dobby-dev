const mongoose = require('mongoose');

const studentTrainingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnailUrl: { type: String },
    thumbnailPublicId: { type: String },
    videoUrl: { type: String },
    videoPublicId: { type: String },
    published: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('StudentTraining', studentTrainingSchema);
