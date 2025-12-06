const Currency = require("../models/Currency");

exports.addCurrency = async (req, res) => {

    try {
        const { currencyName, currencyCode, currencySymbol, exchangeRate } = req.body;

   const currency = await Currency.findOne({ currencyCode });

    if (currency) {
      return res.status(400).json({
        message: "Currency already exists",
      });
    }

  const newCurrency = await Currency.create({
    currencyName,currencyCode,currencySymbol,exchangeRate
  })

  res.status(200).json({
    message:"currency created successfully",
    newCurrency
  })

    } catch (error) {
        res.status(500).json({message:error.message})
    }


};

exports.updateCurrency = async(req,res) => {
    try {
    const { id } = req.params;
    const { currencyName, currencyCode, currencySymbol, exchangeRate } = req.body;

    const updated = await Currency.findByIdAndUpdate(
      id,
      { currencyName, currencyCode, currencySymbol, exchangeRate },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Currency not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

}

exports.getCurrency = async (req, res) => {
  try {
    const currency = await Currency.find();
    res.json(currency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



exports.deleteCurrency = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Currency.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Currency not found" });
    res.json({ message: "Currency deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.toggleCurrency = async (req, res) => {
  try {
    const { id } = req.params;
    const currency = await Currency.findById(id);

    if (!currency) return res.status(404).json({ message: "Currency not found" });

    currency.isActive = !currency.isActive;
    await currency.save();

    res.json(currency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getActiveCurrency = async (req, res) => {
  try {
    const currency = await Currency.find({ isActive: true });
    res.json(currency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

