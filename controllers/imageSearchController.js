const Product = require("../models/productModel");

/**
 * Search products by image analysis
 * This analyzes the image description/colors and matches with product tags and descriptions
 */
exports.searchProductsByImage = async (req, res) => {
  try {
    const { imageDescription, colors, detectedObjects } = req.body;

    if (!imageDescription && !colors && !detectedObjects) {
      return res.status(400).json({
        success: false,
        message: "Please provide image analysis data",
      });
    }

    // Build search query based on image analysis
    const searchTerms = [];
    
    if (imageDescription) {
      searchTerms.push(...imageDescription.toLowerCase().split(' '));
    }
    
    if (detectedObjects && Array.isArray(detectedObjects)) {
      searchTerms.push(...detectedObjects.map(obj => obj.toLowerCase()));
    }
    
    if (colors && Array.isArray(colors)) {
      searchTerms.push(...colors.map(color => color.toLowerCase()));
    }

    // Remove duplicates and common words
    const uniqueTerms = [...new Set(searchTerms)].filter(
      term => term.length > 2 && !['the', 'and', 'with', 'for'].includes(term)
    );

    if (uniqueTerms.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No matching products found",
        products: [],
        searchedTerms: [],
      });
    }

    // Search products using detected terms
    const products = await Product.find({
      status: "active",
      $or: [
        {
          productName: {
            $regex: uniqueTerms.join('|'),
            $options: "i",
          },
        },
        {
          description: {
            $regex: uniqueTerms.join('|'),
            $options: "i",
          },
        },
        {
          searchTags: {
            $in: uniqueTerms.map(term => new RegExp(term, 'i')),
          },
        },
      ],
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("shop", "shopName logo")
      .select("-__v")
      .limit(20)
      .sort({ averageRating: -1 })
      .lean();

    // Calculate relevance score for each product
    const productsWithScore = products.map(product => {
      let score = 0;
      const productText = `${product.productName} ${product.description || ''} ${(product.searchTags || []).join(' ')}`.toLowerCase();
      
      uniqueTerms.forEach(term => {
        const occurrences = (productText.match(new RegExp(term, 'gi')) || []).length;
        score += occurrences;
      });
      
      return { ...product, relevanceScore: score };
    });

    // Sort by relevance score
    productsWithScore.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.status(200).json({
      success: true,
      count: productsWithScore.length,
      products: productsWithScore,
      searchedTerms: uniqueTerms,
      message: productsWithScore.length > 0 
        ? `Found ${productsWithScore.length} matching products`
        : "Sorry, we couldn't find any matching products for this image",
    });
  } catch (error) {
    console.error("Error in image search:", error);
    res.status(500).json({
      success: false,
      message: "Error searching products by image",
      error: error.message,
    });
  }
};

/**
 * Analyze image and extract searchable information
 * This is a simplified version - in production, you'd use AI/ML services like
 * Google Vision API, AWS Rekognition, or Azure Computer Vision
 */
exports.analyzeImage = async (req, res) => {
  try {
    // In a real implementation, you would:
    // 1. Upload image to cloud storage
    // 2. Use AI service to analyze image
    // 3. Extract objects, colors, text, labels
    // 4. Return structured data
    
    // For now, returning mock analysis
    // Client will send base64 or URL and we'll simulate analysis
    
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: "Please provide image data",
      });
    }

    // Mock response - replace with actual AI analysis
    res.status(200).json({
      success: true,
      analysis: {
        labels: ["furniture", "outdoor", "chair", "table"],
        colors: ["brown", "beige", "white"],
        objects: ["chair", "table", "furniture"],
        confidence: 0.85,
      },
      message: "Image analyzed successfully",
    });
  } catch (error) {
    console.error("Error analyzing image:", error);
    res.status(500).json({
      success: false,
      message: "Error analyzing image",
      error: error.message,
    });
  }
};
