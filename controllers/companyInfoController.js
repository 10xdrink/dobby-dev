import CompanyInfo from "../models/companyInfo.js"; 

// Create
export const createCompanyInfo = async (req, res) => {
  try {
    const company = new CompanyInfo(req.body); 
    await company.save();
    res.status(201).json({ success: true, company });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Get All
export const getCompanyInfo = async (req, res) => {
  try {
    const companies = await CompanyInfo.find(); 
    res.json({ success: true, companies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update
export const updateCompanyInfo = async (req, res) => {
  try {
    const company = await CompanyInfo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!company) {
      return res.status(404).json({ success: false, error: "Company information not found" });
    }
    res.json({ success: true, company });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Delete
export const deleteCompanyInfo = async (req, res) => {
  try {
    const company = await CompanyInfo.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, error: "Company information not found" });
    }
    res.json({ success: true, message: "Company information deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
