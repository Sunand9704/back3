const mongoose = require("mongoose");
require("dotenv").config();

const Category = require("../models/Category");
const Product = require("../models/Product");

// Existing categories from the old enum
const EXISTING_CATEGORIES = [
  "Shop all",
  "Sanchi Stupa",
  "Warli House",
  "Tiger Crafting",
  "Bamboo Peacock",
  "Miniaure Ship",
  "Bamboo Trophy",
  "Bamboo Ganesha",
  "Bamboo Swords",
  "Tribal Mask -1",
  "Tribal Mask -2",
  "Bamboo Dry Fruit Tray",
  "Bamboo Tissue Paper Holder",
  "Bamboo Strip Tray",
  "Bamboo Mobile Booster",
  "Bamboo Card-Pen Holder",
];

async function migrateCategories() {
  try {
    console.log("Starting category migration...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Create categories from existing enum values
    for (const categoryName of EXISTING_CATEGORIES) {
      const existingCategory = await Category.findOne({ name: categoryName });

      if (!existingCategory) {
        const newCategory = new Category({
          name: categoryName,
          description: `${categoryName} products`,
          isActive: true,
          sortOrder: EXISTING_CATEGORIES.indexOf(categoryName),
        });

        await newCategory.save();
        console.log(`Created category: ${categoryName}`);
      } else {
        console.log(`Category already exists: ${categoryName}`);
      }
    }

    // Get all products and ensure they have valid categories
    const products = await Product.find({});
    console.log(`Found ${products.length} products to validate`);

    for (const product of products) {
      if (product.category) {
        const categoryExists = await Category.findOne({
          name: product.category,
        });
        if (!categoryExists) {
          console.log(
            `Product ${product.name} has invalid category: ${product.category}`
          );
          // You can choose to set a default category or leave it as is
          // product.category = "Shop all";
          // await product.save();
        }
      }
    }

    console.log("Category migration completed successfully!");

    // Display summary
    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });
    console.log(`Total categories: ${totalCategories}`);
    console.log(`Active categories: ${activeCategories}`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateCategories();
}

module.exports = migrateCategories;
