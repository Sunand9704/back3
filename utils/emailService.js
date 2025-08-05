const nodemailer = require("nodemailer");
require("dotenv").config();

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "laptoptest7788@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "uqfiabjkiqudrgdw",
  },
});

// Email template styles
const emailStyles = `
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #fff;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fff;
        }
        .header {
            background-color: #FFD700;
            color: #333;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background-color: #fff;
            padding: 20px;
            border: 1px solid #FFD700;
            border-radius: 0 0 8px 8px;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background-color: #FFF9C4;
            border-radius: 5px;
        }
        .section-title {
            color: #B8860B;
            margin-bottom: 10px;
            font-size: 18px;
            font-weight: bold;
        }
        .item-list {
            list-style: none;
            padding: 0;
        }
        .item-list li {
            padding: 8px 0;
            border-bottom: 1px solid #FFE082;
        }
        .total {
            font-weight: bold;
            color: #B8860B;
            font-size: 18px;
            margin-top: 15px;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            padding: 15px;
            background-color: #FFD700;
            border-radius: 5px;
            color: #333;
        }
    </style>
`;

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error("Email configuration error:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// Send order confirmation email to user
const sendOrderConfirmationToUser = async (userEmail, orderDetails) => {
  try {
    console.log("Preparing to send user email to:", userEmail);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: "Order Confirmation - Your Pickle Order",
      html: orderConfirmationTemplate(orderDetails),
    };

    console.log("Sending user email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("User email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending user email:", error);
    throw error;
  }
};

// Send order notification email to admin
const sendOrderNotificationToAdmin = async (orderDetails) => {
  try {
    console.log("Preparing to send admin email to:", process.env.ADMIN_EMAIL);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "New Order Received",
      html: adminNotificationTemplate(orderDetails),
    };

    console.log("Sending admin email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Admin email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending admin email:", error);
    throw error;
  }
};

// Send OTP to vendor email
const sendOtpVendorEmail = async (vendorEmail, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: vendorEmail,
      subject: "Your Vendor OTP Code",
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #333; text-align: center;">Your OTP Code</h2>
                    <p style="font-size: 18px; text-align: center; letter-spacing: 2px; font-weight: bold;">${otp}</p>
                    <p style="color: #666; font-size: 14px;">This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
                </div>
            `,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Vendor OTP email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending vendor OTP email:", error);
    throw error;
  }
};

const orderConfirmationTemplate = (orderDetails) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .status { 
            display: inline-block;
            padding: 5px 10px;
            border-radius: 15px;
            font-weight: bold;
            margin: 5px 0;
        }
        .status-paid { background: #D1FAE5; color: #065F46; }
        .status-pending { background: #FEF3C7; color: #92400E; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Order Confirmation</h1>
        </div>
        <div class="content">
            <p>Dear ${orderDetails.userName},</p>
            <p>Thank you for your order! Your order has been confirmed.</p>
            
            <h2>Order Details:</h2>
            <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
            <p><strong>Order Date:</strong> ${new Date(
              orderDetails.orderDate
            ).toLocaleDateString()}</p>
            <p><strong>Delivery Date:</strong> ${new Date(
              orderDetails.deliveryDate
            ).toLocaleDateString()}</p>
            <p><strong>Delivery Time:</strong> ${orderDetails.deliveryTime}</p>
            
            <h3>Payment Information:</h3>
            <p><strong>Payment Status:</strong> 
                <span class="status ${
                  orderDetails.paymentStatus === "paid"
                    ? "status-paid"
                    : "status-pending"
                }">
                    ${orderDetails.paymentStatus}
                </span>
            </p>
            <p><strong>Total Amount:</strong> ₹${orderDetails.totalAmount}</p>

            <h3>Delivery Address:</h3>
            <p>${orderDetails.address}</p>

            <h3>Order Items:</h3>
            <ul>
                ${orderDetails.items
                  .map(
                    (item) => `
                    <li>${item.name} (${item.category || "N/A"}) - Quantity: ${
                      item.quantity
                    } - Price: ₹${item.price}</li>
                `
                  )
                  .join("")}
            </ul>
        </div>
        <div class="footer">
            <p>Thank you for choosing our service!</p>
        </div>
    </div>
</body>
</html>
`;

const adminNotificationTemplate = (orderDetails) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .status { 
            display: inline-block;
            padding: 5px 10px;
            border-radius: 15px;
            font-weight: bold;
            margin: 5px 0;
        }
        .status-paid { background: #D1FAE5; color: #065F46; }
        .status-pending { background: #FEF3C7; color: #92400E; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Order Notification</h1>
        </div>
        <div class="content">
            <h2>Order Details:</h2>
            <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
            <p><strong>Customer Email:</strong> ${orderDetails.userEmail}</p>
            <p><strong>Order Date:</strong> ${new Date(
              orderDetails.orderDate
            ).toLocaleDateString()}</p>
            <p><strong>Delivery Date:</strong> ${new Date(
              orderDetails.deliveryDate
            ).toLocaleDateString()}</p>
            <p><strong>Delivery Time:</strong> ${orderDetails.deliveryTime}</p>
            
            <h3>Payment Information:</h3>
            <p><strong>Payment Status:</strong> 
                <span class="status ${
                  orderDetails.paymentStatus === "paid"
                    ? "status-paid"
                    : "status-pending"
                }">
                    ${orderDetails.paymentStatus}
                </span>
            </p>
            <p><strong>Total Amount:</strong> ₹${orderDetails.totalAmount}</p>

            <h3>Delivery Address:</h3>
            <p>${orderDetails.address}</p>

            <h3>Order Items:</h3>
            <ul>
                ${orderDetails.items
                  .map(
                    (item) => `
                    <li>${item.name} (${item.category || "N/A"}) - Quantity: ${
                      item.quantity
                    } - Price: ₹${item.price}</li>
                `
                  )
                  .join("")}
            </ul>
        </div>
        <div class="footer">
            <p>Please process this order as soon as possible.</p>
        </div>
    </div>
</body>
</html>
`;

module.exports = {
  sendOrderConfirmationToUser,
  sendOrderNotificationToAdmin,
  sendOtpVendorEmail,
};
