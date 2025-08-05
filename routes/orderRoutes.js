// Get recent orders
router.get("/recent", async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("user", "email")
      .populate("items.product", "name price");

    res.json({
      success: true,
      orders: orders.map((order) => ({
        _id: order._id,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        userEmail: order.user.email,
        items: order.items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          category: item.category,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching recent orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch recent orders",
    });
  }
});
