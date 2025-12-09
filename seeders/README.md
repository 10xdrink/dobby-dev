# Banner Seeder

This seeder populates the database with sample banner data for the hero slider.

## How to Run

### From Backend folder:
```bash
node seeders/bannerSeeder.js
```

### Or using npm script (add to package.json):
```json
{
  "scripts": {
    "seed:banners": "node seeders/bannerSeeder.js"
  }
}
```

Then run:
```bash
npm run seed:banners
```

## What it Does

1. **Connects to MongoDB** using your MONGO_URL from .env
2. **Clears existing slider banners** to avoid duplicates
3. **Creates 5 sample banners** with:
   - Beautiful Unsplash images
   - Custom titles, subtitles, and descriptions
   - Different button texts and colors
   - Proper display order
   - All published and ready to use

## Banner Fields Created

Each banner includes:
- **Image**: High-quality Unsplash image
- **Title**: Main heading (e.g., "Uncover")
- **Subtitle**: Secondary text (e.g., "Happiness")
- **Description**: Additional context
- **Button Text**: CTA text (e.g., "Shop Now", "Explore Now")
- **Button URL**: Where the button navigates
- **Button Color**: Custom color for CTA button
- **Text Color**: Color for text overlay (default: white)
- **Overlay Opacity**: Darkness of image overlay (0-1)
- **Display Order**: Order in carousel
- **Published**: Set to true (banners are live)

## Sample Banners

1. **Uncover Happiness** → Blue button → /products
2. **Discover Quality** → Green button → /products?category=electronics
3. **Explore Beauty** → Red button → /products?featured=true
4. **Find Perfection** → Purple button → /products?deals=true
5. **New Arrivals** → Orange button → /products?new=true

## After Running Seeder

Your app will immediately show these banners in the hero section with:
- ✅ Beautiful images
- ✅ Custom text overlays
- ✅ Colorful CTA buttons
- ✅ Smooth carousel transitions
- ✅ Proper navigation

## Customizing Banners

### Via Backend API

Update banners through the admin panel or API:

```javascript
PUT /api/banner/:id
{
  "title": "New Title",
  "subtitle": "New Subtitle",
  "buttonText": "Click Here",
  "buttonColor": "#FF6B6B",
  "published": true
}
```

### Via Database

Directly modify in MongoDB:
```javascript
db.banners.updateOne(
  { _id: "banner_id" },
  {
    $set: {
      title: "Custom Title",
      buttonText: "Shop Now",
      buttonColor: "#10B981"
    }
  }
)
```

## Troubleshooting

### Issue: "No banners available" still showing

**Solutions:**
1. Verify seeder ran successfully (check console output)
2. Check MongoDB connection:
   ```bash
   mongo "your_mongodb_url"
   db.banners.find({ published: true, bannerType: "Slider" })
   ```
3. Restart backend server to clear cache
4. Check API endpoint: `https://dobby-dev.onrender.com/api/banner/published?type=Slider`
5. Clear app cache and reload

### Issue: Banners not showing in app

**Solutions:**
1. Check console logs in app for API errors
2. Verify backend URL in `DobbyApp/services/api.ts`
3. Test API directly in browser
4. Check `published: true` in database
5. Verify `bannerType: "Slider"` is correct

## Environment Variables Required

Make sure your `.env` has:
```env
MONGO_URI=your_mongodb_connection_string
```

**Note:** The seeder will also check for `MONGO_URL` as a fallback.

## Banner Types

- **Slider**: Hero carousel banners (this seeder)
- **mainSectionBanner**: Content area banners
- **footerBanner**: Footer promotional banners

## Next Steps

After seeding:
1. ✅ Open your app - banners will load automatically
2. ✅ Test carousel swiping
3. ✅ Click buttons to test navigation
4. ✅ Customize banners in admin panel
5. ✅ Add more banners via API

Enjoy your beautiful banner system! 🎉
