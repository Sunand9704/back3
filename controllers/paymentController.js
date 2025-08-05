const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const User = require("../models/User");
const {
  sendOrderConfirmationToUser,
  sendOrderNotificationToAdmin,
} = require("../utils/emailService");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;
    console.log(amount, (currency = "INR"), receipt);
    const options = {
      amount: amount * 100,
      currency,
      receipt,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: "Error creating order" });
  }
};

// Verify payment and create order
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData,
    } = req.body;
    // Verify the payment signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature",
      });
    }

    let order;
    // If orderData is provided, create a new order
    if (orderData) {
      order = new Order({
        user: req.user.id,
        items: orderData.items,
        totalAmount: orderData.totalAmount,
        address: orderData.address,
        deliveryDate: orderData.deliveryDate,
        deliveryTime: orderData.deliveryTime,
        paymentMethod: orderData.paymentMethod || "Online",
        paymentStatus: "paid",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        status: "confirmed",
      });

      await order.save();
      await order.populate("user", "email name");
      await order.populate("items.product");
    } else {
      // Try to find existing order (fallback for backward compatibility)
      order = await Order.findOne({ orderId: razorpay_order_id })
        .populate("user", "email name")
        .populate("items.product");

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        });
      }

      // Update order status
      order.status = "confirmed";
      order.paymentId = razorpay_payment_id;
      order.paymentStatus = "paid";
      await order.save();
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
      userName: order.user.name,
      address: formattedAddress,
      deliveryDate: order.deliveryDate,
      deliveryTime: order.deliveryTime,
      paymentStatus: order.paymentStatus,
    };

    try {
      // Send confirmation email to user
      const userEmailResult = await sendOrderConfirmationToUser(
        order.user.email,
        orderDetails
      );
      // Send notification email to admin
      const adminEmailResult = await sendOrderNotificationToAdmin(orderDetails);

      res.json({
        success: true,
        message: "Payment verified and order confirmed",
        order: {
          _id: order._id,
          status: order.status,
          paymentId: order.paymentId,
          paymentStatus: order.paymentStatus,
        },
        emailStatus: {
          userEmailSent: true,
          adminEmailSent: true,
        },
      });
    } catch (emailError) {
      console.error("Error sending emails:", emailError);
      // Still return success for payment verification, but indicate email failure
      res.json({
        success: true,
        message:
          "Payment verified and order confirmed, but email sending failed",
        order: {
          _id: order._id,
          status: order.status,
          paymentId: order.paymentId,
        },
        emailStatus: {
          error: emailError.message,
        },
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment: " + error.message,
    });
  }
};
