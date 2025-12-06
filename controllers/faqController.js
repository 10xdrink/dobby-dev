// paras mourya

const Faq = require("../models/faq");

exports.getFaq = async (req, res, next) => {
  try {
    const faqs = await Faq.find();
    res.status(200).json(faqs);
  } catch (error) {
    next(error);
  }
};

exports.createFaq = async (req, res, next) => {
  const { question, answer } = req.body;

  try {
    const faq = await Faq.create({
      question,
      answer,
    });

    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      faq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getFaqById = async (req, res, next) => {
  try {
    const faqItem = await Faq.findById(req.params.id);
    if (!faqItem) {
      return res.status(404).json({ message: "FAQ not found" });
    }
    res.status(200).json(faqItem);
  } catch (error) {
    next(error);
  }
};

exports.updateFaq = async (req, res, next) => {
  const { question, answer } = req.body;

  try {
    const faq = await Faq.findByIdAndUpdate(
      req.params.id,
      { question, answer },
      { new: true }
    );

    if (!faq) {
      return res.status(404).json({ message: "FAQ not found" });
    }

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      faq,
    });
  } catch (error) {
    next(error);
  }
};
exports.deleteFaq = async(req,res,next)=>{
  try {
    const faq = await Faq.findByIdAndDelete(req.params.id);
    if (!faq) {
      return res.status(404).json({ message: "FAQ not found" });
    }
    res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
