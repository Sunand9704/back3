const express = require("express");
const router = express.Router();
const {
  getAllCategories,
  getActiveCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} = require("../controllers/categoryController");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { upload, convertToRelativePath } = require("../middleware/upload");

// Public routes
router.get("/active", getActiveCategories);
router.get("/:id", getCategoryById);

// Protected routes (admin only)
router.get("/", authenticateToken, isAdmin, getAllCategories);
router.post(
  "/",
  authenticateToken,
  isAdmin,
  upload.single("image"),
  convertToRelativePath,
  createCategory
);
router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  upload.single("image"),
  convertToRelativePath,
  updateCategory
);
router.delete("/:id", authenticateToken, isAdmin, deleteCategory);
router.patch("/:id/toggle", authenticateToken, isAdmin, toggleCategoryStatus);

module.exports = router;
