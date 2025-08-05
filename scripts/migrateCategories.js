const mongoose = require("mongoose");
require("dotenv").config();

const Category = require("../models/Category");
const Product = require("../models/Product");

// Bamboo products that should be categorized under "Bamboo"
const BAMBOO_PRODUCTS = [
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

// Main categories
const MAIN_CATEGORIES = ["Shop all", "Bamboo"];

async function migrateCategories() {
  try {
    console.log("Starting category migration...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Step 1: Create main categories
    console.log("Creating main categories...");
    for (const categoryName of MAIN_CATEGORIES) {
      const existingCategory = await Category.findOne({ name: categoryName });

      if (!existingCategory) {
        const newCategory = new Category({
          name: categoryName,
          description:
            categoryName === "Bamboo"
              ? "Handcrafted bamboo products and traditional artifacts"
              : `${categoryName} products`,
          isActive: true,
          sortOrder: MAIN_CATEGORIES.indexOf(categoryName),
        });

        await newCategory.save();
        console.log(`Created category: ${categoryName}`);
      } else {
        console.log(`Category already exists: ${categoryName}`);
      }
    }

    // Step 2: Update products to use the "Bamboo" category
    console.log("Updating products to use 'Bamboo' category...");
    const bambooCategory = await Category.findOne({ name: "Bamboo" });

    if (!bambooCategory) {
      throw new Error("Bamboo category not found!");
    }

    let updatedProducts = 0;
    for (const productName of BAMBOO_PRODUCTS) {
      const products = await Product.find({ name: productName });

      for (const product of products) {
        if (product.category !== "Bamboo") {
          product.category = "Bamboo";
          await product.save();
          updatedProducts++;
          console.log(`Updated product: ${product.name} -> Bamboo category`);
        }
      }
    }

    // Step 3: Clean up old individual categories (optional - commented out for safety)
    console.log("Cleaning up old individual categories...");
    for (const productName of BAMBOO_PRODUCTS) {
      const oldCategory = await Category.findOne({ name: productName });
      if (oldCategory) {
        await Category.deleteOne({ name: productName });
        console.log(`Removed old category: ${productName}`);
      }
    }

    // Step 4: Validate all products have valid categories
    console.log("Validating product categories...");
    const allProducts = await Product.find({});
    console.log(`Found ${allProducts.length} products to validate`);

    const validCategories = await Category.find({ isActive: true });
    const validCategoryNames = validCategories.map((cat) => cat.name);

    for (const product of allProducts) {
      if (product.category && !validCategoryNames.includes(product.category)) {
        console.log(
          `Product ${product.name} has invalid category: ${product.category}`
        );
        // Set default category for invalid ones
        product.category = "Shop all";
        await product.save();
        console.log(`Fixed product ${product.name} -> Shop all category`);
      }
    }

    console.log("Category migration completed successfully!");

    // Display summary
    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });
    console.log(`Total categories: ${totalCategories}`);
    console.log(`Active categories: ${activeCategories}`);
    console.log(`Products updated to Bamboo category: ${updatedProducts}`);
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
