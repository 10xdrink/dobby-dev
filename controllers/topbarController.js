const Topbar = require("../models/Topbar");
const SecondTopbar = require("../models/secondTopbar");

// topbar 
exports.createTopbar = async (req, res) => {
  try {
    const { bgColor, textColor, text, status } = req.body;
    let topbar = await Topbar.findOne();

    if (topbar) {
      topbar.bgColor = bgColor;
      topbar.textColor = textColor;
      topbar.text = text;
      topbar.status = status || "active";
      await topbar.save();
    } else {
      topbar = await Topbar.create({ bgColor, textColor, text, status });
    }

    res.status(201).json({
      success: true,
      message: "Topbar saved successfully",
      topbar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTopbar = async (req, res) => {
  try {
    const topbar = await Topbar.findOne();
    res.status(200).json({ success: true, topbar });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// secondTopbar
exports.createSecondTopbar = async (req, res) => {
  try {
    const { bgColor, textColor, text1, text2, text3, disText1, disText2, status } = req.body;
    let secondTopbar = await SecondTopbar.findOne();

    if (secondTopbar) {
      secondTopbar.bgColor = bgColor;
      secondTopbar.textColor = textColor;
      secondTopbar.text1 = text1;
      secondTopbar.text2 = text2;
      secondTopbar.text3 = text3;
      secondTopbar.disText1 = disText1;
      secondTopbar.disText2 = disText2;
      secondTopbar.status = status || "active";
      await secondTopbar.save();
    } else {
      secondTopbar = await SecondTopbar.create({ bgColor, textColor, text1, text2, text3, disText1, disText2, status });
    }

    res.status(201).json({
      success: true,
      secondTopbar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSecondTopbar = async (req, res) => {
  try {
    const secondTopbar = await SecondTopbar.findOne();
    res.status(200).json({ success: true, secondTopbar });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
