const Category = require("../models/Category");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");

// Get all categories (admin)
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Error fetching categories" });
  }
};

// Get active categories (public)
exports.getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({
      sortOrder: 1,
      name: 1,
    });
    res.json(categories);
  } catch (error) {
    console.error("Error fetching active categories:", error);
    res.status(500).json({ error: "Error fetching categories" });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Error fetching category" });
  }
};

// Create new category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, isActive, sortOrder } = req.body;

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name: name.trim() });
    if (existingCategory) {
      return res
        .status(400)
        .json({ error: "Category with this name already exists" });
    }

    let imageData = {};

    // Handle image upload if provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories",
      });

      imageData = {
        url: result.secure_url,
        public_id: result.public_id,
      };

      // Delete temp local file
      fs.unlinkSync(req.file.path);
    }

    const category = new Category({
      name: name.trim(),
      description: description?.trim(),
      image: imageData,
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(400).json({ error: error.message });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, isActive, sortOrder } = req.body;

    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if name is being changed and if it conflicts with existing category
    if (name && name.trim() !== existingCategory.name) {
      const nameConflict = await Category.findOne({
        name: name.trim(),
        _id: { $ne: categoryId },
      });
      if (nameConflict) {
        return res
          .status(400)
          .json({ error: "Category with this name already exists" });
      }
    }

    let imageData = existingCategory.image;

    // Handle new image upload if provided
    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (existingCategory.image && existingCategory.image.public_id) {
        try {
          await cloudinary.uploader.destroy(existingCategory.image.public_id);
        } catch (cloudinaryError) {
          console.error(
            "Error deleting old image from Cloudinary:",
            cloudinaryError
          );
        }
      }

      // Upload new image
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories",
      });

      imageData = {
        url: result.secure_url,
        public_id: result.public_id,
      };

      // Delete temp local file
      fs.unlinkSync(req.file.path);
    }

    const updateData = {
      name: name ? name.trim() : existingCategory.name,
      description:
        description !== undefined
          ? description.trim()
          : existingCategory.description,
      image: imageData,
      isActive: isActive !== undefined ? isActive : existingCategory.isActive,
      sortOrder:
        sortOrder !== undefined ? sortOrder : existingCategory.sortOrder,
    };

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(400).json({ error: error.message });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if category is being used by any products
    const Product = require("../models/Product");
    const productsUsingCategory = await Product.findOne({
      category: category.name,
    });

    if (productsUsingCategory) {
      return res.status(400).json({
        error:
          "Cannot delete category. It is being used by one or more products. Please reassign or delete those products first.",
      });
    }

    // Delete image from Cloudinary if exists
    if (category.image && category.image.public_id) {
      try {
        await cloudinary.uploader.destroy(category.image.public_id);
      } catch (cloudinaryError) {
        console.error("Error deleting image from Cloudinary:", cloudinaryError);
      }
    }

    await Category.findByIdAndDelete(categoryId);
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Error deleting category" });
  }
};

// Toggle category status
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json(category);
  } catch (error) {
    console.error("Error toggling category status:", error);
    res.status(500).json({ error: "Error toggling category status" });
  }
};
