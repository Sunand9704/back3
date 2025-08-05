const express = require("express");
const router = express.Router();
const {
  sendOrderConfirmationToUser,
  sendOrderNotificationToAdmin,
} = require("../utils/emailService");
const Order = require("../models/Order");
const User = require("../models/User");
require("dotenv").config();

// Simple test route
router.get("/", (req, res) => {
  res.json({ message: "Test route is working" });
});

// Test email route - supports both GET and POST
router.all("/test-email", async (req, res) => {
  try {
    // Log environment variables
    console.log("Environment Variables:");
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL);
    console.log("EMAIL_PASSWORD exists:", !!process.env.EMAIL_PASSWORD);
    console.log(
      "EMAIL_PASSWORD length:",
      process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.length : 0
    );

    // Check if .env file is loaded
    if (
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASSWORD ||
      !process.env.ADMIN_EMAIL
    ) {
      return res.status(400).json({
        success: false,
        error: "Email configuration is missing. Please check your .env file.",
        config: {
          hasEmailUser: !!process.env.EMAIL_USER,
          hasEmailPassword: !!process.env.EMAIL_PASSWORD,
          hasAdminEmail: !!process.env.ADMIN_EMAIL,
          emailUser: process.env.EMAIL_USER || "not set",
          adminEmail: process.env.ADMIN_EMAIL || "not set",
          passwordLength: process.env.EMAIL_PASSWORD
            ? process.env.EMAIL_PASSWORD.length
            : 0,
        },
      });
    }

    // Get order ID from request body or use latest order
    const { orderId } = req.body || {};
    let order;

    if (orderId) {
      // Find specific order
      order = await Order.findById(orderId)
        .populate("user", "email name")
        .populate("items.product");

      if (!order) {
        return res.status(404).json({
          success: false,
          error: `Order with ID ${orderId} not found`,
        });
      }
    } else {
      // Get the latest order
      order = await Order.findOne()
        .populate("user", "email name")
        .populate("items.product")
        .sort({ createdAt: -1 });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "No orders found in the database",
        });
      }
    }

    // Format address for email
    const formattedAddress = `
${order.address.street}
${order.address.city}, ${order.address.state}
PIN: ${order.address.pincode}
        `.trim();

    // Prepare order details for email
    const orderDetails = {
      orderId: order._id,
      orderDate: order.createdAt,
      items: order.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category,
      })),
      totalAmount: order.totalAmount,
      userEmail: order.user.email,
      address: formattedAddress,
      deliveryDate: order.deliveryDate,
      deliveryTime: order.deliveryTime,
      // Add raw address data for API response
      rawAddress: order.address,
    };

    console.log("Testing email configuration with order data...");
    console.log("Order ID:", orderDetails.orderId);
    console.log("User Email:", orderDetails.userEmail);
    console.log("Admin Email:", process.env.ADMIN_EMAIL);
    console.log("Order Details:", JSON.stringify(orderDetails, null, 2));

    try {
      // Test user email
      console.log("Attempting to send user email...");
      const userEmailResult = await sendOrderConfirmationToUser(
        orderDetails.userEmail,
        orderDetails
      );
      console.log("User email sent successfully:", userEmailResult.messageId);

      // Test admin email
      console.log("Attempting to send admin email...");
      const adminEmailResult = await sendOrderNotificationToAdmin(orderDetails);
      console.log("Admin email sent successfully:", adminEmailResult.messageId);

      res.json({
        success: true,
        message: "Test emails sent successfully with order data",
        orderDetails: {
          ...orderDetails,
          address: orderDetails.rawAddress, // Send structured address in API response
        },
        userEmailId: userEmailResult.messageId,
        adminEmailId: adminEmailResult.messageId,
      });
    } catch (emailError) {
      console.error("Error sending emails:", emailError);
      res.status(500).json({
        success: false,
        error: "Failed to send emails",
        details: emailError.message,
        stack: emailError.stack,
        config: {
          hasEmailUser: !!process.env.EMAIL_USER,
          hasEmailPassword: !!process.env.EMAIL_PASSWORD,
          hasAdminEmail: !!process.env.ADMIN_EMAIL,
        },
      });
    }
  } catch (error) {
    console.error("Error in test email route:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      config: {
        hasEmailUser: !!process.env.EMAIL_USER,
        hasEmailPassword: !!process.env.EMAIL_PASSWORD,
        hasAdminEmail: !!process.env.ADMIN_EMAIL,
      },
    });
  }
});

module.exports = router;
