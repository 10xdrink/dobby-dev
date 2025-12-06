const { createAndEmitNotification } = require("../helpers/notification");
const StudentFAQ = require("../models/StudentFAQ") 


exports.getAllFaqs = async (req, res) => {
    try {
        const faqs = await StudentFAQ.find().sort({ createdAt: -1 });
        res.status(200).json(faqs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.createFaq = async (req, res) => {
    try {
        const { question, answer } = req.body;
        const newFaq = new StudentFAQ({ question, answer });
        await newFaq.save();

        await createAndEmitNotification({
            title:"New FAQ Added!",
            message:`Admin added a new FAQ`,
            event:"new-faq-added",
            targetModels:["Student"],
            meta:{
                faqId :newFaq._id,
            question,          
          }
        })
         console.log("Notification sent to all students")

        

       

        res.status(201).json(newFaq);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedFaq = await StudentFAQ.findByIdAndUpdate(id, req.body, { new: true });

        
        res.status(200).json(updatedFaq);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        await StudentFAQ.findByIdAndDelete(id);

        
        res.status(200).json({ message: 'Student FAQ deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getPublishedFaqs = async (req, res) => {
    try {
        const faqs = await StudentFAQ.find({ published: true }).sort({ createdAt: -1 });
        res.status(200).json(faqs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
