const mongoose = require('mongoose');

const studentFaqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    published: { type: Boolean, default: false }, 
}, { timestamps: true });

module.exports = mongoose.model('StudentFAQ', studentFaqSchema);
