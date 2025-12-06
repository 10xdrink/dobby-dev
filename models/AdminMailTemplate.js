const mongoose = require('mongoose');

const adminMailTemplateSchema = new mongoose.Schema({
     logoUrl: { type: String },
    logoPublicId: { type: String }, 
    title: { type: String, required: true },
    mailBody: { type: String, required: true },
    
    footerSectionText: { type: String },

    
    pageLinks: {
        privacyPolicy: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "https://test-dobby.vercel.app/privacy-policy" }
        },
        refundPolicy: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "https://test-dobby.vercel.app/refund-policy" }
        },
        cancellationPolicy: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "https://test-dobby.vercel.app/cancellation-policy" }
        },
        contactUs: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "https://test-dobby.vercel.app/contact-us" }
        }
    },

    
    socialMediaLinks: {
        facebook: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "" }
        },
        instagram: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "" }
        },
        X: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "" }
        },
        linkedin: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "" }
        },
        youtube: { 
            enabled: { type: Boolean, default: false },
            url: { type: String, default: "" }
        }
    },

    copyrightText: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminMailTemplate', adminMailTemplateSchema);
