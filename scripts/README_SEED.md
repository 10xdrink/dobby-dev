# Product Seeding Script

This script automatically seeds the database with 30 sample products across 5 different categories.

## 📦 What Gets Created

### Categories & Subcategories

1. **Electronics** (6 products)
   - Mobile Phones: iPhone 15 Pro, Samsung Galaxy S24
   - Laptops: MacBook Pro M3, Dell XPS 15
   - Headphones: Sony WH-1000XM5
   - Cameras: Canon EOS R6

2. **Fashion** (6 products)
   - Men's Clothing: Levi's Jeans, Adidas Tracksuit
   - Women's Clothing: Zara Dress
   - Footwear: Nike Air Max
   - Accessories: Ray-Ban Sunglasses, Leather Wallet

3. **Home & Kitchen** (6 products)
   - Furniture: IKEA Study Table, Urban Ladder Sofa
   - Kitchenware: Prestige Induction Cooktop, Hawkins Pressure Cooker
   - Home Decor: Wall Painting Set
   - Appliances: LG Washing Machine

4. **Books** (5 products)
   - Fiction: The Alchemist, Harry Potter Collection
   - Non-Fiction: Atomic Habits
   - Educational: Physics NCERT Class 12
   - Comics: Marvel Comics Bundle

5. **Sports & Fitness** (7 products)
   - Gym Equipment: Adjustable Dumbbells, Yoga Mat, Resistance Bands
   - Sports Wear: Nike Dri-FIT T-Shirt
   - Outdoor Gear: Camping Tent, Cricket Bat
   - Nutrition: Whey Protein 1kg

## 🚀 How to Run

### Initial Seeding (Create 30 Products with Images)

**Method 1: Using npm script (Recommended)**
```bash
npm run seed:products
```

**Method 2: Direct execution**
```bash
node scripts/seedProducts.js
```

### Update Existing Products with Images

If you already have products without images, run:

```bash
npm run update:images
```

This will add CDN image URLs to all products that don't have images yet.

## ✨ Features

- **Smart Detection**: Checks if categories, subcategories, and products already exist
- **Auto Shop Creation**: Creates a sample shop if none exists
- **User Creation**: Creates a sample shopkeeper user if needed
- **Unique SKUs**: Generates unique SKU codes for each product
- **Realistic Data**: Products have realistic prices, stock levels, and discounts
- **Real CDN Images**: All products include high-quality images from Unsplash CDN
- **Status Indicators**: Clear console output with emojis showing progress
- **Safe Execution**: Won't duplicate existing products

## 🖼️ Product Images

All products include real product images hosted on **Unsplash CDN**, providing:
- ✅ High-quality, professional images
- ✅ Fast loading via CDN
- ✅ No storage cost (external CDN)
- ✅ Royalty-free images
- ✅ Optimized for web (500px width)

## 📋 Requirements

- MongoDB connection configured in `.env`
- `MONGO_URI` environment variable set
- All dependencies installed (`npm install`)

## 🛠️ What Happens During Seeding

1. **Database Connection**: Connects to MongoDB
2. **Product Check**: Counts existing products
3. **Category Setup**: Creates/finds 5 main categories
4. **Subcategory Setup**: Creates/finds subcategories under each category
5. **Shop Setup**: Creates/finds an active shop
6. **Product Creation**: Creates 30 unique products
7. **Summary Report**: Shows statistics of created items

## 📊 Sample Output

```
🌱 Starting Product Seeding Process...

📦 Existing products in database: 0

📁 Setting up categories and subcategories...

✅ Created category: Electronics
  ✅ Created subcategory: Mobile Phones
  ✅ Created subcategory: Laptops
  ✅ Created subcategory: Headphones
  ✅ Created subcategory: Cameras

🏪 Setting up shop...

✅ Created new shop: Dobby Marketplace

📦 Creating products...

  ✅ Created: iPhone 15 Pro (SKU: IPH-A3F2B1)
  ✅ Created: Samsung Galaxy S24 (SKU: SGA-C4D5E6)
  ...

============================================================
🎉 Product Seeding Complete!
============================================================
✅ Successfully created: 30 products
⏭️  Skipped (already exist): 0 products
📦 Total products in database: 30
============================================================
```

## 🔧 Customization

To customize the products, edit the `productTemplates` array in `seedProducts.js`:

```javascript
const productTemplates = [
  { 
    name: "Product Name",
    category: "Category Name",
    subCategory: "Subcategory Name",
    price: 9999,
    description: "Product description",
    unit: "piece",
    stock: 50,
    discount: 1000
  },
  // Add more products...
];
```

## ⚠️ Important Notes

- **One-time Setup**: This script is designed for initial database setup
- **Existing Data**: Script checks for duplicates and won't recreate existing items
- **Shop Requirement**: Products require a shop; script creates one automatically
- **Active Status**: All created products have "active" status
- **Stock Levels**: All products start with stock based on the template

## 🗑️ Clearing Data

To clear existing products before reseeding:

```javascript
// In MongoDB shell or Node.js script
await Product.deleteMany({});
await ProductCategory.deleteMany({});
await ProductSubCategory.deleteMany({});
```

Or use MongoDB Compass/Shell to manually delete documents.

## 🐛 Troubleshooting

### "MongoDB Connection Failed"
- Check your `.env` file has correct `MONGO_URI`
- Ensure MongoDB is running
- Verify network connectivity

### "Duplicate key error"
- Some products already exist with same name/SKU
- Script will skip duplicates automatically

### "Active shop required"
- Script creates a shop automatically
- Check if shop creation succeeded
- Verify user creation worked

## 📞 Support

If you encounter issues:
1. Check MongoDB connection
2. Verify all environment variables are set
3. Check console output for specific errors
4. Review the script logs for details
