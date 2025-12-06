const ReferralClick = require("../models/ReferralClick");
const Student = require("../models/student");
exports.recordReferralClick = async (req, res) => {
  try {
    const ref = req.query.ref || req.body.ref;
    if (!ref)
      return res.redirect(
        process.env.FRONTEND_PROD + "/?form=shopkeeper-register"
      );

    const student = await Student.findOne({ affiliateCode: ref });
    if (student) {
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
      await ReferralClick.create({
        studentId: student._id,
        ipAddress: ip,
        userAgent: req.headers["user-agent"],
        refCode: ref,
      });
    }
    const redirectUrl = student
      ? `${process.env.FRONTEND_PROD}/?form=shopkeeper-register&ref=${student.affiliateCode}`
      : `${process.env.FRONTEND_PROD}/?form=shopkeeper-register`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error(err);
    return res.redirect(
      process.env.FRONTEND_PROD + "/?form=shopkeeper-register"
    );
  }
};