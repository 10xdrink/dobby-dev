const FILLER_WORDS = [
  'show me',
  'i want',
  'please',
  'can you',
  'give me',
  'find me',
  'search for',
  'looking for',
  'i need',
  'get me',
  'i am looking for',
];

const SIZE_KEYWORDS = {
  small: ['small', 's', 'xs', 'extra small'],
  medium: ['medium', 'm', 'med'],
  large: ['large', 'l', 'big'],
  'x-large': ['xl', 'x-large', 'extra large', 'xtra large'],
  'xx-large': ['xxl', 'xx-large', '2xl', 'double xl'],
};

const COLOR_KEYWORDS = [
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'pink', 'brown', 'gray', 'grey', 'beige', 'navy', 'maroon', 'gold',
  'silver', 'cream', 'olive', 'cyan', 'magenta',
];

const PRICE_PATTERNS = [
  { pattern: /under (\d+)/i, type: 'max' },
  { pattern: /below (\d+)/i, type: 'max' },
  { pattern: /less than (\d+)/i, type: 'max' },
  { pattern: /above (\d+)/i, type: 'min' },
  { pattern: /over (\d+)/i, type: 'min' },
  { pattern: /more than (\d+)/i, type: 'min' },
  { pattern: /between (\d+) and (\d+)/i, type: 'range' },
];

const SYNONYMS = {
  'tee': 't-shirt',
  'tshirt': 't-shirt',
  'sneakers': 'shoes',
  'trainers': 'shoes',
  'kicks': 'shoes',
  'pants': 'trousers',
  'jeans': 'trousers',
  'hoodie': 'sweatshirt',
  'jumper': 'sweater',
  'pullover': 'sweater',
  'specs': 'glasses',
  'shades': 'sunglasses',
  'mobile': 'phone',
  'cell': 'phone',
  'laptop': 'computer',
  'pc': 'computer',
};

function parseVoiceQuery(transcript) {
  if (!transcript) return { cleanQuery: '', filters: {} };

  let text = transcript.toLowerCase().trim();
  const filters = {};

  // Extract price filters
  for (const pricePattern of PRICE_PATTERNS) {
    const match = text.match(pricePattern.pattern);
    if (match) {
      if (pricePattern.type === 'max') {
        filters.maxPrice = parseInt(match[1]);
      } else if (pricePattern.type === 'min') {
        filters.minPrice = parseInt(match[1]);
      } else if (pricePattern.type === 'range') {
        filters.minPrice = parseInt(match[1]);
        filters.maxPrice = parseInt(match[2]);
      }
      text = text.replace(pricePattern.pattern, '').trim();
    }
  }

  // Extract color
  for (const color of COLOR_KEYWORDS) {
    if (text.includes(color)) {
      filters.color = color;
      break;
    }
  }

  // Extract size
  for (const [size, keywords] of Object.entries(SIZE_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        filters.size = size;
        break;
      }
    }
    if (filters.size) break;
  }

  // Remove filler words
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`^${filler}\\s+`, 'i');
    text = text.replace(regex, '').trim();
  }

  // Apply synonyms
  for (const [from, to] of Object.entries(SYNONYMS)) {
    const regex = new RegExp(`\\b${from}\\b`, 'gi');
    text = text.replace(regex, to);
  }

  // Clean up extra spaces
  text = text.replace(/\s+/g, ' ').trim();

  return {
    cleanQuery: text,
    filters,
  };
}

module.exports = { parseVoiceQuery };
