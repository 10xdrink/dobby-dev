const OAuthProvider = require("../models/OauthProvider");
const logger = require("../config/logger")

exports.upsertProvider = async (req, res) => {
  try {
    const { provider, clientId, clientSecret, callbackURL, isActive, teamId, keyId } = req.body;

    const updateData = { clientId, clientSecret, callbackURL, isActive };

    
    if (provider === "apple") {
      updateData.teamId = teamId;
      updateData.keyId = keyId;
    }

    const providerData = await OAuthProvider.findOneAndUpdate(
      { provider },
      updateData,
      { new: true, upsert: true }
    );

     logger.info(`OAuth provider upserted: ${provider} (isActive: ${isActive})`);
    logger.debug(`Provider data: ${JSON.stringify(providerData, null, 2)}`);


    
    // const { setupOAuthStrategies } = require("../config/passport");
    // await setupOAuthStrategies();

    res.json({ success: true, data: providerData });
  } catch (error) {
      logger.error(`Error upserting OAuth provider: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getAllProviders = async (req, res) => {
  try {
    const providers = await OAuthProvider.find();
    logger.info(`Fetched all OAuth providers. Count: ${providers.length}`);
    logger.debug(`Providers data: ${JSON.stringify(providers, null, 2)}`);

    res.json({ success: true, data: providers });
  } catch (error) {
     logger.error(`Error fetching all OAuth providers: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveProviders = async (req, res) => {
  try {
    const activeProviders = await OAuthProvider.find({ isActive: true });
     logger.info(`Fetched active OAuth providers. Count: ${activeProviders.length}`);
    logger.debug(`Active providers data: ${JSON.stringify(activeProviders, null, 2)}`);

    res.json({ success: true, data: activeProviders });
  } catch (error) {
    logger.error(`Error fetching active OAuth providers: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};
