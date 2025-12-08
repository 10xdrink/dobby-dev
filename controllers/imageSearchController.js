const Product = require("../models/productModel");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
 * Analyze image and extract searchable information using Cloudinary AI
 */
exports.analyzeImage = async (req, res) => {
  try {
    const { imageUri, imageBase64 } = req.body;
    
    if (!imageUri && !imageBase64) {
      return res.status(400).json({
        success: false,
        message: "Please provide image data (URI or base64)",
      });
    }

    let uploadResult;
    
    // Upload image to Cloudinary
    if (imageBase64) {
      // Upload base64 image
      uploadResult = await cloudinary.uploader.upload(imageBase64, {
        folder: "dobby_image_search",
        resource_type: "auto",
        categorization: "google_tagging",
        auto_tagging: 0.6,
      });
    } else {
      // Upload from URI
      uploadResult = await cloudinary.uploader.upload(imageUri, {
        folder: "dobby_image_search",
        resource_type: "auto",
        categorization: "google_tagging",
        auto_tagging: 0.6,
      });
    }

    // Get image analysis from Cloudinary
    const analysis = {
      labels: [],
      colors: [],
      objects: [],
      confidence: 0,
    };

    // Extract tags from Cloudinary's Google tagging
    if (uploadResult.info && uploadResult.info.categorization) {
      const categories = uploadResult.info.categorization.google_tagging;
      if (categories && categories.data) {
        categories.data.forEach(tag => {
          if (tag.confidence > 0.6) {
            analysis.labels.push(tag.tag.toLowerCase());
          }
        });
      }
    }

    // Extract dominant colors
    if (uploadResult.colors) {
      uploadResult.colors.forEach(colorArray => {
        const hexColor = colorArray[0];
        const colorName = getColorName(hexColor);
        if (colorName && !analysis.colors.includes(colorName)) {
          analysis.colors.push(colorName);
        }
      });
    }

    // If no tags found, use basic detection from format and resource type
    if (analysis.labels.length === 0) {
      // Fallback: extract keywords from filename or context
      const filename = uploadResult.original_filename || "";
      const words = filename.toLowerCase().split(/[_\-\s]+/);
      analysis.labels = words.filter(w => w.length > 2);
    }

    analysis.objects = [...analysis.labels];
    analysis.confidence = analysis.labels.length > 0 ? 0.8 : 0.3;

    // Clean up: delete image from Cloudinary after analysis (optional)
    // await cloudinary.uploader.destroy(uploadResult.public_id);

    res.status(200).json({
      success: true,
      analysis,
      uploadedUrl: uploadResult.secure_url,
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

/**
 * Convert hex color to color name
 */
function getColorName(hex) {
  const colorMap = {
    // Browns
    "8B4513": "brown", "A0522D": "brown", "D2691E": "brown", "CD853F": "tan",
    // Grays
    "808080": "gray", "A9A9A9": "gray", "C0C0C0": "silver", "696969": "gray",
    // Whites/Beiges
    "FFFFFF": "white", "F5F5DC": "beige", "FAF0E6": "beige", "FAEBD7": "beige",
    // Blues
    "0000FF": "blue", "4169E1": "blue", "1E90FF": "blue", "87CEEB": "blue",
    // Greens
    "008000": "green", "00FF00": "green", "90EE90": "green", "3CB371": "green",
    // Reds
    "FF0000": "red", "DC143C": "red", "B22222": "red", "CD5C5C": "red",
    // Yellows
    "FFFF00": "yellow", "FFD700": "gold", "FFA500": "orange", "FF8C00": "orange",
    // Blacks
    "000000": "black", "2F4F4F": "black", "191970": "navy",
  };

  // Remove # if present
  hex = hex.replace("#", "").toUpperCase();
  
  // Direct match
  if (colorMap[hex]) {
    return colorMap[hex];
  }
  
  // Find closest color
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Simple color detection based on RGB values
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  if (max < 60) return "black";
  if (min > 200) return "white";
  if (diff < 30) return max > 128 ? "gray" : "dark gray";
  
  if (r > g && r > b) {
    return r > 200 && g < 100 ? "red" : "orange";
  } else if (g > r && g > b) {
    return "green";
  } else if (b > r && b > g) {
    return "blue";
  } else if (r > 150 && g > 150) {
    return "yellow";
  } else if (r > 100 && g > 50 && b < 50) {
    return "brown";
  }
  
  return "mixed";
}
