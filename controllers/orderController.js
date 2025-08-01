const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const {
  sendOrderConfirmationToUser,
  sendOrderNotificationToAdmin,
} = require("../utils/emailService");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
// Get all orders for a user
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("user", "name email phone")
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Error fetching orders" });
  }
};

// Get a single order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("user", "name email phone");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Return the complete order object including payment status
    res.json({
      order: {
        ...order.toObject(),
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Error fetching order" });
  }
};

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      address,
      deliveryDate,
      deliveryTime,
      paymentStatus,
      amount,   
      currency = "INR",
      receipt,
    } = req.body;
    console.log("items", items);
    const userId = req.user._id;
    // Create the order
    const order = new Order({
      user: userId,
      items,
      address,
      totalAmount: items?.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      ),
      status: "pending",
      paymentStatus,
    });
    await order.save();
    console.log("the saved order", order);

    // Update sold count for each product in the order
    try {
      for (const item of items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { soldCount: item.quantity } },
          { new: true }
        );
      }
      console.log("Updated sold count for all products in order");
    } catch (updateError) {
      console.error("Error updating sold count:", updateError);
      // Don't fail the order creation if sold count update fails
    }

    // Populate user and product details for email
    const populatedOrder = await Order.findById(order._id)
      .populate("user", "email name")
      .populate("items.product", "name");

    if (!populatedOrder) {
      throw new Error("Failed to populate order details");
    }
    console.log("after populating the order");
    // Format address for email
    const formattedAddress = `
${order.address.street}
${order.address.city}, ${order.address.state}
PIN: ${order.address.pincode}
        `.trim();
    console.log("after formatting the address");
    // Prepare order details for email
    const orderDetails = {
      orderId: order._id,
      orderDate: order.createdAt,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount: order.totalAmount,
      userEmail: populatedOrder.user.email,
      userName: populatedOrder.user.name,
      address: formattedAddress,
      deliveryDate: order.deliveryDate || null,
      deliveryTime: order.deliveryTime || null,
      paymentStatus: order.paymentStatus,
    };

    console.log("Sending order confirmation emails...");
    console.log("Order Details:", JSON.stringify(orderDetails, null, 2));

    try {
      // Send confirmation email to user
      const userEmailResult = await sendOrderConfirmationToUser(
        populatedOrder.user.email,
        orderDetails
      );
      console.log("User email sent successfully:", userEmailResult.messageId);

      // Send notification email to admin
      const adminEmailResult = await sendOrderNotificationToAdmin(orderDetails);
      console.log("Admin email sent successfully:", adminEmailResult.messageId);

      res.status(201).json({
        success: true,
        message: "Order created successfully and confirmation emails sent",
        order: {
          _id: order._id,
          items: order.items,
          totalAmount: order.totalAmount,
          deliveryDate: order.deliveryDate || null,
          deliveryTime: order.deliveryTime || null,
          status: order.status,
        },
        emailStatus: {
          userEmailSent: true,
          adminEmailSent: true,
        },
      });
    } catch (emailError) {
      console.error("Error sending emails:", emailError);
      // Still return success for order creation, but indicate email failure
      res.status(201).json({
        success: true,
        message: "Order created successfully but email sending failed",
        order: {
          _id: order._id,
          items: order.items,
          totalAmount: order.totalAmount,
          deliveryDate: order.deliveryDate || null,
          deliveryTime: order.deliveryTime || null ,
          status: order.status,
        },
        emailStatus: {
          error: emailError.message,
        },
      });
    }
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create order: " + error.message,
    });
  }
};

// Get all orders (admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.product")
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ error: "Error fetching orders" });
  }
};

// Utility function to update product sold count
const updateProductSoldCount = async (orderId, action = "add") => {
  try {
    const order = await Order.findById(orderId).populate("items.product");
    if (!order) return;

    for (const item of order.items) {
      const quantity = action === "add" ? item.quantity : -item.quantity;
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { soldCount: quantity } },
        { new: true }
      );
    }
    console.log(`Updated sold count for order ${orderId} (action: ${action})`);
  } catch (error) {
    console.error("Error updating sold count:", error);
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    // Validate status
    const validStatuses = [
      "pending",
      "confirmed",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Update order with new status and payment status
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updateData = {
      status,
      // Only update payment status to paid if it's a cash on delivery order
      paymentStatus:
        status === "delivered" && !order.paymentId
          ? "paid"
          : order.paymentStatus,
    };

    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("items.product")
      .populate("user", "name email phone");

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Return the complete order object including payment status
    res.json({
      order: {
        ...updatedOrder.toObject(),
        paymentStatus: updatedOrder.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Error updating order status" });
  }
};

// Verify delivery OTP
exports.verifyDeliveryOTP = async (req, res) => {
  try {
    const { orderId, otp } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Update order status to delivered
    order.status = "delivered";
    await order.save();

    res.json({ message: "Delivery verified successfully" });
  } catch (error) {
    console.error("Error verifying delivery OTP:", error);
    res.status(500).json({ error: "Error verifying delivery OTP" });
  }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if order can be cancelled
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({ error: "Order cannot be cancelled" });
    }

    // Update order status
    order.status = "cancelled";
    await order.save();

    // Restore product stock and reduce sold count
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          stock: item.quantity,
          soldCount: -item.quantity, // Reduce sold count when order is cancelled
        },
      });
    }

    res.json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Error cancelling order" });
  }
};

// Get order statistics (for admin)
exports.getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      {
        $match: { status: { $ne: "cancelled" } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    res.json({
      stats,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: "Error fetching order statistics" });
  }
};

// Get all bamboo category orders (admin)
exports.getBambooOrders = async (req, res) => {
  try {
    // Find all orders, populate product details for filtering
    const orders = await Order.find()
      .populate({
        path: "items.product",
        select: "name category",
      })
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    // Filter orders where at least one item.product.category contains 'bamboo' (case-insensitive)
    const bambooOrders = orders.filter((order) =>
      order.items.some(
        (item) =>
          item.product &&
          typeof item.product.category === "string" &&
          item.product.category.toLowerCase().includes("bamboo")
      )
    );

    res.json(bambooOrders);
  } catch (error) {
    console.error("Error fetching bamboo orders:", error);
    res.status(500).json({ error: "Error fetching bamboo orders" });
  }
};
