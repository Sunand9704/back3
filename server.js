require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "https://vin2admin.onrender.com/",
    "https://vinfrontned.onrender.com",
    "https://admin.vin2grow.in",
    "https://front3-f3cj.onrender.com",
    "https://vin2grow-latest-admin.onrender.com",
    "https://vin2grow-latest-frontend.onrender.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
const productsDir = path.join(uploadsDir, "products");

if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
  fs.chmodSync(productsDir, "755");
}

// Serve static files
app.use("/uploads", express.static(uploadsDir));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/test", require("./routes/test"));
app.use("/api/vendor", require("./routes/vendor"));

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Optional root message
app.get("/", (req, res) => {
  res.send("Vin2Grow API is running");
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server after MongoDB connects
const PORT = process.env.PORT || 10000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });
