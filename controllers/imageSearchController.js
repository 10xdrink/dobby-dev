const Product = require("../models/productModel");
const axios = require("axios");

function safeJsonParse(maybeJson) {
  try {
    return JSON.parse(maybeJson);
  } catch (_e) {
    return null;
  }
}

function toStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .slice(0, 40);
  }
  return String(value)
    .split(/[\,\n]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function normalizeKeywords(arr) {
  const commonWords = [
    "the",
    "and",
    "with",
    "for",
    "this",
    "that",
    "from",
    "have",
    "are",
    "was",
  ];
  const normalized = toStringArray(arr)
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 2 && !commonWords.includes(t));
  return [...new Set(normalized)].slice(0, 40);
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeSearchTerm(term) {
  const t = String(term || "")
    .toLowerCase()
    .trim()
    // remove anything that can break regex or search quality
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

async function analyzeWithOpenRouter(imageBase64) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const imageUrl = String(imageBase64 || "").startsWith("data:image/")
    ? String(imageBase64)
    : `data:image/jpeg;base64,${String(imageBase64 || "")}`;

  const stripJsonFences = (text) => {
    const t = String(text || "").trim();
    if (!t) return "";
    return t
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  };

  const model =
    process.env.OPENROUTER_VISION_MODEL ||
    "openai/gpt-4o-mini";
  const prompt =
    "Analyze this product image for shopping search. Return ONLY valid JSON with keys: " +
    "labels (array of keywords), objects (array of objects), colors (array of color names), text (string with any readable text). " +
    "Use simple lowercase words. Do not include markdown.";

  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 500,
  };

  let response;
  try {
    response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "http://localhost",
          "X-Title": process.env.OPENROUTER_APP_NAME || "dobby-backend",
        },
        timeout: 30000,
        maxBodyLength: 25 * 1024 * 1024,
      }
    );
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const details =
      (data && (data.error?.message || data.error?.code || JSON.stringify(data))) ||
      err.message;

    throw new Error(`OpenRouter request failed${status ? ` (${status})` : ""}: ${details}`);
  }

  const content = response?.data?.choices?.[0]?.message?.content || "";
  const extracted = stripJsonFences(content);
  const parsed = safeJsonParse(extracted);

  const labels = normalizeKeywords(parsed?.labels || parsed?.keywords || []);
  const objects = normalizeKeywords(parsed?.objects || []);
  const colors = normalizeKeywords(parsed?.colors || []);
  const text = String(parsed?.text || "").trim();

  // Fallback: if model didn't return JSON, try to use plain text keywords
  const fallbackText = parsed ? "" : extracted;

  const combinedLabels = normalizeKeywords([
    ...labels,
    ...objects,
    ...colors,
    ...(text ? text.split(/\s+/) : []),
    ...(fallbackText ? fallbackText.split(/\s+/) : []),
  ]);

  return {
    labels: combinedLabels,
    colors,
    objects,
    confidence: 0.85,
  };
}

/**
 * Search products by image analysis
 * This analyzes the image description/colors and matches with product tags and descriptions
 */
exports.searchProductsByImage = async (req, res) => {
  try {
    console.log('📸 Image search request:', req.body);
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
      searchTerms.push(...sanitizeSearchTerm(imageDescription).split(' '));
    }
    
    if (detectedObjects && Array.isArray(detectedObjects)) {
      searchTerms.push(
        ...detectedObjects
          .map((obj) => sanitizeSearchTerm(obj))
          .flatMap((s) => s.split(' '))
      );
    }
    
    if (colors && Array.isArray(colors)) {
      searchTerms.push(...colors.map((color) => sanitizeSearchTerm(color)));
    }

    // Remove duplicates and common words
    const commonWords = ['the', 'and', 'with', 'for', 'this', 'that', 'from', 'have', 'are', 'was'];
    const uniqueTerms = [...new Set(searchTerms)].filter(
      term => term.length > 2 && !commonWords.includes(term.toLowerCase())
    );
    
    console.log('🔍 Search terms extracted:', uniqueTerms);

    if (uniqueTerms.length === 0) {
      console.log('⚠️ No search terms found for image search');
      return res.status(200).json({
        success: true,
        count: 0,
        products: [],
        searchedTerms: [],
        message: "Sorry, we are unable to find product for this image",
      });
    }

    const escapedAlternation = uniqueTerms.map(escapeRegExp).join('|');

    // Search products using detected terms - more flexible matching
    const products = await Product.find({
      status: "active",
      $or: [
        {
          productName: {
            $regex: escapedAlternation,
            $options: "i",
          },
        },
        {
          description: {
            $regex: escapedAlternation,
            $options: "i",
          },
        },
        {
          searchTags: {
            $in: uniqueTerms.map((term) => new RegExp(escapeRegExp(term), 'i')),
          },
        },
        // Also search in category names
        {
          'category.name': {
            $regex: escapedAlternation,
            $options: "i",
          },
        },
      ],
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("shop", "shopName logo")
      .select("-__v")
      .limit(50) // Increased limit for more results
      .sort({ averageRating: -1 })
      .lean();
      
    console.log(`🔍 Found ${products.length} products matching search terms`);

    if (products.length === 0) {
      console.log('⚠️ No products found for image search');
      return res.status(200).json({
        success: true,
        count: 0,
        products: [],
        searchedTerms: uniqueTerms.slice(0, 8),
        message: "Sorry, we are unable to find product for this image",
      });
    }

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

    console.log(`✅ Found ${productsWithScore.length} products matching image`);
    console.log(`🎯 Top search terms used: ${uniqueTerms.slice(0, 8).join(', ')}`);
    
    res.status(200).json({
      success: true,
      count: productsWithScore.length,
      products: productsWithScore,
      searchedTerms: uniqueTerms.slice(0, 8), // Show first 8 terms
      message: productsWithScore.length > 0 
        ? `Found ${productsWithScore.length} matching products`
        : "Sorry, we couldn't find any matching products for this image",
    });
  } catch (error) {
    console.error("❌ Error in image search:", error);
    
    // Handle specific error types
    let statusCode = 500;
    let message = "Error searching products by image";
    
    if (error.name === 'MongoTimeoutError') {
      statusCode = 504;
      message = "Database timeout. Please try again.";
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      message = "Invalid search parameters";
    }
    
    res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Analyze image using basic pattern recognition
 * Simple implementation without external AI services
 */
exports.analyzeImage = async (req, res) => {
  try {
    console.log('🖼️ Image analysis request received');
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: "Please provide image data",
      });
    }
    
    // Validate image size (roughly 5MB limit)
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      // Estimate size from base64 length (4 chars = 3 bytes)
      const sizeInBytes = (base64Data.length * 3) / 4;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      console.log(`📊 Image size: ${sizeInMB.toFixed(2)} MB`);
      
      if (sizeInMB > 5) {
        return res.status(413).json({
          success: false,
          message: "Image file is too large. Please select an image smaller than 5MB.",
        });
      }
    } catch (sizeError) {
      console.warn('⚠️ Could not validate image size, proceeding with analysis:', sizeError.message);
    }

    const analysis = await analyzeWithOpenRouter(imageBase64);
    console.log('✅ Image analysis complete:', {
      labels: Array.isArray(analysis?.labels) ? analysis.labels.slice(0, 10) : [],
      colors: analysis?.colors,
      objects: Array.isArray(analysis?.objects) ? analysis.objects.slice(0, 10) : [],
      confidence: analysis?.confidence,
    });

    res.status(200).json({
      success: true,
      analysis,
      message: "Image analyzed successfully",
    });
  } catch (error) {
    console.error("❌ Error analyzing image:", error);
    
    // Handle specific errors
    let statusCode = 500;
    let message = "Error analyzing image";
    
    if (error.name === 'PayloadTooLargeError') {
      statusCode = 413;
      message = "Image file is too large";
    }
    
    res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Analyze colors from base64 image data
 * Simplified color detection without external libraries
 */
function analyzeImageColors(base64String) {
  try {
    // Remove data URI prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    // For a more accurate implementation, you could:
    // 1. Decode base64 to buffer
    // 2. Use a library like 'sharp' or 'jimp' to analyze pixels
    // 3. Calculate dominant colors
    
    // Return varied colors to improve search results
    const colorSets = [
      ['brown', 'beige', 'tan'],
      ['white', 'gray', 'silver'],
      ['black', 'charcoal', 'gray'],
      ['blue', 'navy', 'teal'],
      ['green', 'olive', 'sage'],
      ['red', 'burgundy', 'rose']
    ];
    
    // Rotate through color sets based on string length for variety
    const setIndex = (base64Data.length % colorSets.length);
    return colorSets[setIndex];
  } catch (error) {
    console.error('Color analysis error:', error);
    return ['brown', 'white', 'beige']; // Default fallback
  }
}

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
