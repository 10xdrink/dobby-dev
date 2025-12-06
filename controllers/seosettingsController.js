const SeoSettings = require("../models/SeoSettings")
const cacheService = require("../services/cacheService");

//  Get SEO settings
exports.getSeoSettings = async (req, res) => {
  try {
    const { page } = req.params;
    const cacheKey = `seo:settings:${page}`;
    
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      const seo = await SeoSettings.findOne({ page });

      if (!seo) {
        return { error: 404, message: "SEO settings not found" };
      }

      return seo;
    });

    if (responseData.error) {
      return res.status(responseData.error).json({ message: responseData.message });
    }

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

//  Update or Create SEO settings
exports.updateSeoSettings = async (req, res) => {
  try {
    const { page } = req.params;
    const { pageTitle, content, keywords } = req.body;

    const seo = await SeoSettings.findOneAndUpdate(
      { page },
      {
        pageTitle,
        content,
        keywords: keywords ? keywords.split(",").map(k => k.trim()) : [],
      },
      { new: true, upsert: true } 
    );

    await cacheService.delete(`seo:settings:${page}`);

    res.json({ success: true, seo });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
