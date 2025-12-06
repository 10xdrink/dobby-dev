const Campaign = require("../models/Campaign");
const axios = require("axios");

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER = process.env.MAILCHIMP_SERVER;
const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;


exports.createCampaign = async (req, res) => {
  try {
    const {
      campaignName,
      emailSubject,
      emailContent,
      emailTemplate,
      discountCode,
      recipientGroup,
      sendDate   
    } = req.body;

    //  Mailchimp campaign create
    const mailchimpRes = await axios.post(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns`,
      {
        type: "regular",
        recipients: { list_id: AUDIENCE_ID },
        settings: {
          subject_line: emailSubject,
          title: campaignName,
          from_name: "Dobby Mall",
          reply_to: "info@digitalmongers.com"
        }
      },
      { headers: { Authorization: `apikey ${MAILCHIMP_API_KEY}` } }
    );

    const mailchimpCampaignId = mailchimpRes.data.id;

    //. Mailchimp campaign content set
    await axios.put(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns/${mailchimpCampaignId}/content`,
      { html: emailContent },
      { headers: { Authorization: `apikey ${MAILCHIMP_API_KEY}` } }
    );

   
    if (sendDate) {
      await axios.post(
        `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns/${mailchimpCampaignId}/actions/schedule`,
        { schedule_time: new Date(sendDate).toISOString() },
        { headers: { Authorization: `apikey ${MAILCHIMP_API_KEY}` } }
      );
    }

   
    const campaign = await Campaign.create({
      campaignName,
      emailSubject,
      emailContent,
      emailTemplate,
      discountCode,
      recipientGroup,
      sendDate,
      mailchimpCampaignId,
      status: sendDate ? "scheduled" : "sent" 
    });

    res.json({ message: "Campaign created successfully", campaign });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Campaign creation failed" });
  }
};


exports.sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    
    await axios.post(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns/${campaign.mailchimpCampaignId}/actions/send`,
      {},
      { headers: { Authorization: `apikey ${MAILCHIMP_API_KEY}` } }
    );

   
    const reportRes = await axios.get(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/reports/${campaign.mailchimpCampaignId}`,
      { headers: { Authorization: `apikey ${MAILCHIMP_API_KEY}` } }
    );

    const report = reportRes.data;

    
    campaign.status = "sent";
    campaign.sentCount = report.emails_sent || 0;
    campaign.emailsSent = report.emails_sent || 0;
    campaign.lastSentAt = new Date();

    await campaign.save();

    res.json({ message: "Campaign sent successfully", campaign });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Campaign sending failed" });
  }
};


exports.getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const statsRes = await axios.get(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/reports/${campaign.mailchimpCampaignId}`,
      { headers: { Authorization: `apikey ${MAILCHIMP_API_KEY}` } }
    );

    const stats = statsRes.data;

    campaign.emailsSent = stats.emails_sent || 0;
    campaign.openRate = stats.opens?.open_rate || 0;
    campaign.clickRate = stats.clicks?.click_rate || 0;
    await campaign.save();

    res.json({ message: "Campaign stats updated", campaign });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};


exports.getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};
