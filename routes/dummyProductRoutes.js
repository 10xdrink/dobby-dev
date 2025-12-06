const express = require("express");
const router = express.Router();
const axios = require("axios");

//  Get all products
router.get("/products", async (req, res) => {
  try {
    const response = await axios.get("https://dummyjson.com/products");
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products" });
  }
});

//  Search products
router.get("/products/search", async (req, res) => {
  const { q } = req.query;
  try {
    const response = await axios.get(`https://dummyjson.com/products/search?q=${q}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching search results" });
  }
});

// Get single product by ID
router.get("/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.get(`https://dummyjson.com/products/${id}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product details" });
  }
});

module.exports = router;
