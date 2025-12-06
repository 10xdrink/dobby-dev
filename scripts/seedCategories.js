require('dotenv').config();
const mongoose = require('mongoose');
const ProductCategory = require('../models/ProductCategory');
const ProductSubCategory = require('../models/SubProductCategory');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  }
};

const categories = [
  {
    name: 'Electronics',
    status: 'active',
  },
  {
    name: 'Fashion',
    status: 'active',
  },
  {
    name: 'Home & Kitchen',
    status: 'active',
  },
  {
    name: 'Beauty & Personal Care',
    status: 'active',
  },
  {
    name: 'Sports & Fitness',
    status: 'active',
  },
  {
    name: 'Books & Stationery',
    status: 'active',
  },
  {
    name: 'Toys & Games',
    status: 'active',
  },
  {
    name: 'Automotive',
    status: 'active',
  },
];

const subCategories = {
  'Electronics': ['Mobile Phones', 'Laptops', 'Headphones', 'Cameras', 'Smart Watches'],
  'Fashion': ['Men\'s Clothing', 'Women\'s Clothing', 'Shoes', 'Bags', 'Accessories'],
  'Home & Kitchen': ['Furniture', 'Kitchen Appliances', 'Home Decor', 'Bedding', 'Storage'],
  'Beauty & Personal Care': ['Skincare', 'Makeup', 'Hair Care', 'Fragrances', 'Personal Care'],
  'Sports & Fitness': ['Gym Equipment', 'Sports Wear', 'Yoga', 'Cycling', 'Running'],
  'Books & Stationery': ['Books', 'Notebooks', 'Pens', 'Art Supplies', 'Office Supplies'],
  'Toys & Games': ['Action Figures', 'Board Games', 'Educational Toys', 'Puzzles', 'Outdoor Toys'],
  'Automotive': ['Car Accessories', 'Bike Accessories', 'Tools', 'Parts', 'Care Products'],
};

const seedCategories = async () => {
  try {
    await connectDB();

    // Clear existing categories and subcategories
    console.log('🗑️  Clearing existing categories...');
    await ProductCategory.deleteMany({});
    await ProductSubCategory.deleteMany({});

    console.log('📦 Seeding categories...');
    
    for (const categoryData of categories) {
      // Create category
      const category = await ProductCategory.create(categoryData);
      console.log(`✅ Created category: ${category.name}`);

      // Create subcategories for this category
      const subCatNames = subCategories[category.name] || [];
      for (const subCatName of subCatNames) {
        const subCategory = await ProductSubCategory.create({
          name: subCatName,
          category: category._id,
        });
        console.log(`  ✅ Created subcategory: ${subCategory.name}`);
      }
    }

    console.log('\n🎉 Categories seeded successfully!');
    console.log(`📊 Total Categories: ${categories.length}`);
    
    const totalSubCategories = await ProductSubCategory.countDocuments();
    console.log(`📊 Total SubCategories: ${totalSubCategories}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  }
};

seedCategories();
