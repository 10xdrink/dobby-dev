const Blog = require("../models/Blog");
const Category = require("../models/Category");
const  cloudinary  = require("../config/cloudinary");


exports.createBlog = async (req, res) => {
  try {
    const { title, content, category, slug, metaTitle, metaDescription, metaKeywords } = req.body;

    if (!title || !category || !slug) {
      return res.status(400).json({ message: "Title, Slug, and Category are required." });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: "Invalid Category ID." });
    }

    const featuredImage = req.file ? req.file.path : null;
    const featuredImageId = req.file ? req.file.filename : null;

    const blog = await Blog.create({
      title,
      featuredImage,
      featuredImageId,
      content,
      category,
      slug: slug.trim(),
      metaTitle,
      metaDescription,
      metaKeywords: metaKeywords ? metaKeywords.split(",").map((k) => k.trim()) : [],
    });

    res.status(201).json(blog);
  } catch (error) {
    console.error("ERROR CREATING BLOG:", error);
    res.status(500).json({ message: error.message });
  }
};



exports.getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().populate("category");
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



exports.getBlogBySlug = async (req, res) => {
  try {
    const slug = req.params.slug.trim();
    const blog = await Blog.findOne({ slug: req.params.slug }).populate('category');
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};





exports.updateBlog = async (req, res) => {
  try {
    const { title, content, category, slug, metaTitle, metaDescription, metaKeywords } = req.body;
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

   
    if (req.file) {
  if (blog.featuredImageId) {
    await cloudinary.uploader.destroy(blog.featuredImageId); 
  }
  blog.featuredImage = req.file.path; 
  blog.featuredImageId = req.file.filename || req.file.path.split("/").pop().split(".")[0]; 
}


    if (title) blog.title = title;
    if (content) blog.content = content;
    if (slug) blog.slug = slug.trim();
    if (metaTitle) blog.metaTitle = metaTitle;
    if (metaDescription) blog.metaDescription = metaDescription;
    if (metaKeywords) blog.metaKeywords = metaKeywords.split(",").map((k) => k.trim());
    if (category) blog.category = category;

    await blog.save();
    res.json(blog);
  } catch (error) {
    console.error("ERROR UPDATING BLOG:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    
    if (blog.featuredImageId) {
  await cloudinary.uploader.destroy(blog.featuredImageId);
}


    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getBlogsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const blogs = await Blog.find({ category: categoryId }).populate
    ("category");
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

