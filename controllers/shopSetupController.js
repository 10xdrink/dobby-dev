// const ShopSetup = require("../models/shopSetup");


// const createShopSetup = async (req, res) => {
//   try {
//     const { shopName, shopOwnerName, shopAddress, GSTIN } = req.body;

//     // Add userId from middleware 
//     const userId = req.user.id; 

//     if (!userId) {
//       return res.status(400).json({ message: "User ID is required" });
//     }

//     const newShopSetup = new ShopSetup({
//       userId,
//       shopName,
//       shopOwnerName,
//       shopAddress,
//       GSTIN
//     });

//     await newShopSetup.save();
//     res.status(201).json({
//       message: "Shop setup created successfully",
//       data: newShopSetup
//     });
//   } catch (error) {
//     console.error("Error creating shop setup:", error);
//     res.status(500).json({ message: "Error creating shop setup", error });
//   }
// };

// const getAllShops = async (req, res) => {
//   try {
//     const shops = await ShopSetup.find();
//     res.status(200).json(shops);
//   } catch (error) {
//     console.error("Error fetching shops:", error);
//     res.status(500).json({ message: "Error fetching shops", error });
//   }
// };


// const getShopById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const shop = await ShopSetup.findById(id);

//     if (!shop) {
//       return res.status(404).json({ message: "Shop not found" });
//     }

//     res.status(200).json(shop);
//   } catch (error) {
//     console.error("Error fetching shop:", error);
//     res.status(500).json({ message: "Error fetching shop", error });
//   }
// };


// const updateShopById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updatedShop = await ShopSetup.findByIdAndUpdate(id, req.body, {
//       new: true, 
//       runValidators: true
//     });

//     if (!updatedShop) {
//       return res.status(404).json({ message: "Shop not found" });
//     }

//     res.status(200).json({
//       message: "Shop updated successfully",
//       data: updatedShop
//     });
//   } catch (error) {
//     console.error("Error updating shop:", error);
//     res.status(500).json({ message: "Error updating shop", error });
//   }
// };

// module.exports = {
//   createShopSetup,
//   getAllShops,
//   getShopById,
//   updateShopById
// };
