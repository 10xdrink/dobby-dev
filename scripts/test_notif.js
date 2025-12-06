require("dotenv").config();
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

async function test() {
  try {
    console.log("Loading env...");
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is missing from env");
    }
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    // 1. Create a dummy Admin notification
    const notif = await Notification.create({
      title: "Test Admin Notification",
      message: "This is for admins only",
      event: "TEST_EVENT",
      targetModels: ["Admin"],
      targetUsers: [],
      meta: {},
    });
    console.log("Created notification:", notif._id);

    // 2. Simulate a Customer connecting
    const role = "customer";
    const roleCapitalized = "Customer";
    const id = new mongoose.Types.ObjectId(); // Random ID

    console.log(`Testing for role: ${role}, id: ${id}`);

    const query = {
      $or: [
        { targetModels: { $in: [roleCapitalized, role] } },
        { "targetUsers.userId": id },
      ],
    };

    console.log("Query:", JSON.stringify(query, null, 2));

    const results = await Notification.find(query);

    if (results.some(n => n._id.toString() === notif._id.toString())) {
        console.log("FAIL");
    } else {
        console.log("PASS");
    }

    // Cleanup
    await Notification.findByIdAndDelete(notif._id);
    await mongoose.disconnect();

  } catch (err) {
    console.error(err);
  }
}

test();
