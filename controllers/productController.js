const Product = require("../models/Product");
const Category = require("../models/Category");
const path = require("path");
const fs = require("fs");
const cloudinary = require("../utils/cloudinary");

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Error fetching products" });
  }
};

// Create new product
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      length,
      width,
      height,
      discount,
      isDiscountActive,
      discountStartDate,
      discountEndDate,
      offerPrice,
      offerStartDate,
      offerEndDate,
      isOfferActive,
    } = req.body;
    console.log(category , "sended");
    
    // Validate category exists and is active
    if (category) {
      const categoryExists = await Category.findOne({
        name: category.trim().toLowerCase(),
        isActive: true,
      });
      if (!categoryExists) {
        return res.status(400).json({
          error:
            "Category not found or inactive. Please select a valid category.",
        });
      }
    }

    const uploadedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "products",
        });

        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id,
        });

        fs.unlinkSync(file.path); // Delete temp local file
      }
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      stock,
      length,
      width,
      height,
      images: uploadedImages,
      discount,
      isDiscountActive,
      discountStartDate,
      discountEndDate,
      offerPrice,
      offerStartDate,
      offerEndDate,
      isOfferActive,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};
// Update product
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updateData = { ...req.body };
    const existingProduct = await Product.findById(productId);

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Validate category if it's being updated
    if (
      updateData.category &&
      updateData.category !== existingProduct.category
    ) {
      const categoryExists = await Category.findOne({
        name: updateData.category.trim(),
        isActive: true,
      });
      if (!categoryExists) {
        return res.status(400).json({
          error:
            "Category not found or inactive. Please select a valid category.",
        });
      }
    }

    // Handle image uploads if any
    if (req.files && req.files.length > 0) {
      const uploadedImages = [];

      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "products",
        });

        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id,
        });

        fs.unlinkSync(file.path); // Delete temp local file
      }

      // Add new images to existing ones
      updateData.images = [...existingProduct.images, ...uploadedImages];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};
// ...existing code...
// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Delete images from Cloudinary
    for (const image of product.images) {
      try {
        await cloudinary.uploader.destroy(image.public_id);
      } catch (err) {
        console.error("Error deleting image from Cloudinary:", err);
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single product
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const products = await Product.find({ category }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Error fetching products by category" });
  }
};

// Get best sellers (products with highest sold count)
exports.getBestSellers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6; // Default to 6 products

    // Get products with highest sold count, prioritizing those with sales
    const bestSellers = await Product.find({
      isAvailable: true,
    })
      .sort({ soldCount: -1, createdAt: -1 }) // Sort by sold count first, then by newest
      .limit(limit);

    // Transform the data to match frontend expectations
    const transformedProducts = bestSellers.map((product, index) => {
      const originalPrice = product.price;
      let finalPrice = product.price;
      let discountPercentage = 0;

      // Calculate final price based on active discounts/offers
      if (product.isDiscountActive && product.discount > 0) {
        finalPrice = originalPrice - (originalPrice * product.discount) / 100;
        discountPercentage = product.discount;
      } else if (product.isOfferActive && product.offerPrice) {
        finalPrice = product.offerPrice;
        discountPercentage = Math.round(
          ((originalPrice - product.offerPrice) / originalPrice) * 100
        );
      }

      // Generate badge based on sold count and index
      let badge = "New";
      if (product.soldCount > 100) {
        badge = "Best Seller";
      } else if (product.soldCount > 50) {
        badge = "Popular";
      } else if (product.soldCount > 20) {
        badge = "Trending";
      } else if (product.isDiscountActive || product.isOfferActive) {
        badge = "Hot";
      } else if (index < 2) {
        badge = "Limited";
      }

      return {
        id: product._id,
        name: product.name,
        price: Math.round(finalPrice),
        originalPrice: originalPrice,
        image:
          product.images && product.images.length > 0
            ? product.images[0].url
            : "",
        rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
        reviews: Math.floor(Math.random() * 200) + 50, // Random reviews between 50-250
        sold: product.soldCount, // Use actual sold count
        badge: badge,
        category: product.category,
        description: product.description,
      };
    });

    res.json(transformedProducts);
  } catch (error) {
    console.error("Error fetching best sellers:", error);
    res.status(500).json({ error: "Error fetching best sellers" });
  }
};
