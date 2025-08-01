const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    length: {
      type: Number,
      required: true,
      min: 0,
    },
    width: {
      type: Number,
      required: true,
      min: 0,
    },
    height: {
      type: Number,
      required: true,
      min: 0,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isDiscountActive: {
      type: Boolean,
      default: false,
    },
    discountStartDate: {
      type: Date,
    },
    discountEndDate: {
      type: Date,
    },
    offerPrice: {
      type: Number,
      min: 0,
    },
    offerStartDate: {
      type: Date,
    },
    offerEndDate: {
      type: Date,
    },
    isOfferActive: {
      type: Boolean,
      default: false,
    },
    expiryDays: {
      type: Number,
      default: 7,
    },
    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
