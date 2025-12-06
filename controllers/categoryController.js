const Category = require("../models/Category");

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Category name is required" });

    const category = await Category.create({ name });
    res.status(201).json(category);
  } catch (error) {
    console.error("ERROR CREATING CATEGORY:", error);
    res.status(400).json({ message: error.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCategory = async(req,res) => {

  try {
    const {id} = req.params

  const updateCategory = await Category.findByIdAndUpdate(id,req.body,{new:true,runValidators:true})

  if(!updateCategory){
    return res.status(400).json({ message:"Catrgory not found"})
  }

  res.status(200).json({
    message:"category updated successfully",
    updateCategory,
  })
  } catch (error) {
    res.status(500).json({ message:error.message})
  }

}

exports.deleteCategory = async(req,res) => {
  try {
    const {id} = req.params

  const deleteCategory = await Category.findByIdAndDelete(id)
  if(!deleteCategory){
    return res.status(400).json({
      message:"category not found"
    })
  }

  res.status(200).json({
    message:"category deleted succesfully",
    deleteCategory,
  })
  } catch (error) {
    res.status(500).json({
      message:error.message
    })
  }
}