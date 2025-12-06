const express = require("express");
const {
  createCampaign,
  sendCampaign,
  getCampaignStats,
  getAllCampaigns
} = require("../controllers/campaignController");

const router = express.Router();

router.post("/", createCampaign);
router.post("/:id/send", sendCampaign);   
router.get("/:id/stats", getCampaignStats); 
router.get("/", getAllCampaigns);

module.exports = router;
