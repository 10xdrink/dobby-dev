const ShopkeeperFAQ = require("../models/ShopkeeperFAQ");
const cacheService = require("../services/cacheService");


exports.getAllFaqs = async (req, res) => {
    try {
        const cacheKey = 'shopkeeper:faqs:all';
        const faqs = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
            return await ShopkeeperFAQ.find().sort({ createdAt: -1 });
        });
        res.status(200).json(faqs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.createFaq = async (req, res) => {
    try {
        const { question, answer } = req.body;
        const newFaq = new ShopkeeperFAQ({ question, answer });
        await newFaq.save();
        
        // Invalidate caches
        await cacheService.delete('shopkeeper:faqs:all');
        await cacheService.delete('shopkeeper:faqs:published');
        
        res.status(201).json(newFaq);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedFaq = await ShopkeeperFAQ.findByIdAndUpdate(id, req.body, { new: true });
        
        // Invalidate caches
        await cacheService.delete('shopkeeper:faqs:all');
        await cacheService.delete('shopkeeper:faqs:published');

        res.status(200).json(updatedFaq);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        await ShopkeeperFAQ.findByIdAndDelete(id);
        
        // Invalidate caches
        await cacheService.delete('shopkeeper:faqs:all');
        await cacheService.delete('shopkeeper:faqs:published');

        res.status(200).json({ message: 'Shopkeeper FAQ deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getPublishedFaqs = async (req, res) => {
    try {
        const cacheKey = 'shopkeeper:faqs:published';
        const faqs = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
            return await ShopkeeperFAQ.find({ published: true }).sort({ createdAt: -1 });
        });
        res.status(200).json(faqs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
