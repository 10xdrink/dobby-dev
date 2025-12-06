const mongoose = require('mongoose');

const SocialMediaChatSchema = new mongoose.Schema({
    number: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

module.exports = mongoose.model('SocialMediaChat', SocialMediaChatSchema);
