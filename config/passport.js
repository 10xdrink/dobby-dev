const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const AppleStrategy = require("passport-apple");
const AmazonStrategy = require("passport-amazon").Strategy;
const OAuthProvider = require("../models/OauthProvider")
const Customer = require("../models/Customer");
const logger = require("../config/logger")

// Serialize/Deserialize
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const customer = await Customer.findById(id);
    logger.debug(`Deserialized user: ${customer?.email || id}`);
    done(null, customer);
  } catch (err) {
    logger.error(`Deserialize error: ${err.message}`);
    done(err, null);
  }
});



async function setupOAuthStrategies() {
  try {
    const providers = await OAuthProvider.find({ isActive: true });
    logger.info(`Found ${providers.length} active OAuth providers`);

    providers.forEach((p) => {
       logger.info(`Setting up ${p.provider} strategy`);
       
      switch (p.provider) {
       case "google":
  passport.use(
    new GoogleStrategy(
      {
        clientID: p.clientId,
        clientSecret: p.clientSecret,
        callbackURL: p.callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logger.info(" Google OAuth profile received");
          logger.debug(JSON.stringify(profile, null, 2)); 

          const email =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0].value
              : null;

          if (!email) {
            logger.error(" No email returned from Google profile");
            return done(new Error("No email provided by Google"), null);
          }

          let customer = await Customer.findOne({ email });

          if (!customer) {
            customer = await Customer.create({
              firstName:
                profile.name?.givenName || profile.displayName?.split(" ")[0],
              lastName: profile.name?.familyName || "",
              email,
              authProvider: "google",
            });
            logger.info(` New customer created via Google: ${email}`);
          } else {
            logger.info(` Existing customer logged in via Google: ${email}`);
          }

          return done(null, customer);
        } catch (err) {
          logger.error(` Google strategy error: ${err.message}`);
          return done(err, null);
        }
      }
    )
  );
  break;


        case "facebook":
          passport.use(
            new FacebookStrategy(
              {
                clientID: p.clientId,
                clientSecret: p.clientSecret,
                callbackURL: p.callbackURL,
                profileFields: ["id", "displayName", "emails"],
              },
              async (accessToken, refreshToken, profile, done) => {
                try {
                  let customer = await Customer.findOne({
                    email: profile.emails?.[0]?.value,
                  });

                  if (!customer) {
                    customer = await Customer.create({
                      name: profile.displayName,
                      email: profile.emails?.[0]?.value,
                      authProvider: "facebook",
                    });
                  }

                  return done(null, customer);
                } catch (err) {
                  return done(err, null);
                }
              }
            )
          );
          break;

        case "apple":
  passport.use(
    new AppleStrategy(
      {
        clientID: p.clientId,         
        teamID: p.teamId,             
        keyID: p.keyId,                
        privateKeyString: p.clientSecret, 
        callbackURL: p.callbackURL,
      },
      async (accessToken, refreshToken, idToken, profile, done) => {
        try {
          let customer = await Customer.findOne({ email: profile.email });

          if (!customer) {
            customer = await Customer.create({
              name: profile.name
                ? `${profile.name.firstName} ${profile.name.lastName}`
                : "Apple User",
              email: profile.email,
              authProvider: "apple",
            });
          }

          return done(null, customer);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
  break;

        case "amazon":
          passport.use(
            new AmazonStrategy(
              {
                clientID: p.clientId,
                clientSecret: p.clientSecret,
                callbackURL: p.callbackURL,
              },
              async (accessToken, refreshToken, profile, done) => {
                try {
                  let customer = await Customer.findOne({
                    email: profile.emails?.[0]?.value,
                  });

                  if (!customer) {
                    customer = await Customer.create({
                      name: profile.displayName || "Amazon User",
                      email: profile.emails?.[0]?.value,
                      authProvider: "amazon",
                    });
                  }

                  return done(null, customer);
                } catch (err) {
                  return done(err, null);
                }
              }
            )
          );
          break;
      }
    });
  } catch (err) {
    console.error("Error setting up OAuth strategies:", err);
  }
}


setupOAuthStrategies();

module.exports = { passport, setupOAuthStrategies };


