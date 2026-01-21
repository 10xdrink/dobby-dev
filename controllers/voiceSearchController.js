const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Product = require('../models/productModel');
const { parseVoiceQuery } = require('../utils/voiceQueryParser');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';

const voiceSearch = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'NO_AUDIO_FILE',
        message: 'No audio file provided',
      });
    }

    const filePath = req.file.path;
    console.log('[VoiceSearch] Processing audio file:', filePath);

    // Transcribe audio using OpenRouter (Whisper model)
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'openai/whisper-large-v3');
    formData.append('language', 'en');

    const transcription = await axios.post(OPENROUTER_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://dobby-dev.onrender.com',
        'X-Title': 'Dobby Voice Search',
      },
    });

    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('[VoiceSearch] Error deleting file:', err);
    });

    const rawTranscript = transcription.data?.text || '';
    console.log('[VoiceSearch] Raw transcript:', rawTranscript);

    if (!rawTranscript.trim()) {
      return res.json({
        success: true,
        transcript: '',
        results: [],
        message: "Couldn't hear that—try again",
      });
    }

    // Parse voice query to extract filters and clean the search text
    const { cleanQuery, filters } = parseVoiceQuery(rawTranscript);
    console.log('[VoiceSearch] Parsed query:', cleanQuery);
    console.log('[VoiceSearch] Extracted filters:', filters);

    // Build search query
    const searchQuery = {
      isActive: true,
    };

    // Text search
    if (cleanQuery) {
      searchQuery.$text = { $search: cleanQuery };
    }

    // Apply price filters
    if (filters.minPrice || filters.maxPrice) {
      searchQuery.price = {};
      if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
      if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
    }

    // Apply color filter
    if (filters.color) {
      searchQuery.$or = [
        { name: new RegExp(filters.color, 'i') },
        { description: new RegExp(filters.color, 'i') },
        { 'variants.color': new RegExp(filters.color, 'i') },
      ];
    }

    // Apply size filter
    if (filters.size) {
      searchQuery['variants.size'] = new RegExp(filters.size, 'i');
    }

    console.log('[VoiceSearch] MongoDB query:', JSON.stringify(searchQuery));

    // Search products
    const products = await Product.find(searchQuery)
      .select('name description price images category stock averageRating reviewCount variants')
      .limit(20)
      .lean();

    console.log('[VoiceSearch] Found products:', products.length);

    // Sort by text score if available
    const sortedProducts = cleanQuery && products.length > 0
      ? products.sort((a, b) => {
          const scoreA = a.score || 0;
          const scoreB = b.score || 0;
          return scoreB - scoreA;
        })
      : products;

    return res.json({
      success: true,
      transcript: rawTranscript,
      cleanQuery,
      filters,
      results: sortedProducts,
      count: sortedProducts.length,
    });

  } catch (error) {
    console.error('[VoiceSearch] Error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('[VoiceSearch] Error deleting file:', err);
      });
    }

    return res.status(500).json({
      success: false,
      error: 'VOICE_SEARCH_FAILED',
      message: error.message || 'Voice search processing failed',
    });
  }
};

module.exports = {
  voiceSearch,
};
