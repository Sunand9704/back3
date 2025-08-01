const Vendor = require("../models/Vendor");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateResetToken, sendResetPasswordEmail } = require("../utils/otp");
const { sendOtpVendorEmail } = require("../utils/emailService");

// Vendor login
exports.login = async (req, res) => {
  try {
    const { email, password, category } = req.body;
    const vendor = await Vendor.findOne({ email });
    console.log("Email ok");

    if (!vendor) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    console.log("passowrd ok");
    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    // Check if category exists in vendor's categories
    if (!category || !vendor.category.includes(category)) {
      return res.status(400).json({ error: "Selected category is not associated with this vendor" });
    }
    console.log("matched");

    const token = jwt.sign({ vendorId: vendor._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({
      token,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        isActive: vendor.isActive,
      },
    });
  } catch (error) {
    console.error("Vendor login error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Vendor forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    const resetToken = generateResetToken();
    vendor.resetPasswordToken = resetToken;
    vendor.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await vendor.save();
  } catch (error) {
    console.error("Vendor forgot password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Send OTP to vendor email for password reset
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    vendor.otp = otp;
    vendor.otpExpires = Date.now() + 10 * 60 * 1000; // 10 min
    await vendor.save();
    await sendOtpVendorEmail(email, otp);
    res.json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Verify vendor OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: "Email and OTP are required" });
    const vendor = await Vendor.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() },
    });
    if (!vendor)
      return res.status(400).json({ error: "Invalid or expired OTP" });
    // Optionally clear OTP after verification
    vendor.otp = undefined;
    vendor.otpExpires = undefined;
    await vendor.save();
    res.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Vendor reset password (using email, otp, newPassword)
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res
        .status(400)
        .json({ error: "Email, OTP, and new password are required" });
    const vendor = await Vendor.findOne({
      email
    });
    if (!vendor)
      return res.status(400).json({ error: "Invalid or expired OTP" });
    const salt = await bcrypt.genSalt(10);
    vendor.password = await bcrypt.hash(newPassword, salt);
    vendor.otp = undefined;
    vendor.otpExpires = undefined;
    await vendor.save();
    try {
      await sendResetPasswordEmail(vendor.email, "password_reset_confirmation");
    } catch (emailError) {
      // Don't fail if confirmation email fails
    }
    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Vendor reset password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Vendor update password (requires currentPassword, newPassword, and vendorId)
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, vendorId } = req.body;
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const isMatch = await bcrypt.compare(currentPassword, vendor.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const salt = await bcrypt.genSalt(10);
    vendor.password = await bcrypt.hash(newPassword, salt);
    await vendor.save();
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Vendor update password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Create a new vendor (admin)
exports.createVendor = async (req, res) => {
  try {
    const { name, email, password, category } = req.body;
    if (!name || !email || !password || !category || !category.length) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const existing = await Vendor.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Vendor with this email already exists" });
    }
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);
    const vendor = new Vendor({
      name,
      email,
      password: hashedPassword,
      category,
    });
    await vendor.save();
    res.status(201).json({ message: "Vendor created successfully", vendor });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get all vendors (admin)
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().select('-password').sort({ createdAt: -1 });
    res.json(vendors);
  } catch (error) {
    console.error('Get all vendors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete a vendor by ID (admin)
exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findByIdAndDelete(id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
