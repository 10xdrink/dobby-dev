const Product = require("../models/productModel");
const ProductCategory = require("../models/ProductCategory");
const SubProductCategory = require("../models/SubProductCategory");
const Blog = require("../models/Blog");
const SeoPage = require("../models/SeoPage");
const logger = require("../config/logger");


class SitemapService {
  constructor() {
    this.baseUrl = process.env.FRONTEND_PROD || process.env.FRONTEND_LOCAL || "https://test-dobby.vercel.app";
    this.maxUrlsPerSitemap = 50000; 
    this.defaultPriority = {
      home: "1.0",
      category: "0.8",
      subCategory: "0.7",
      product: "0.6",
      blog: "0.5",
      static: "0.5",
    };
    this.defaultChangeFreq = {
      home: "daily",
      category: "weekly",
      subCategory: "weekly",
      product: "daily",
      blog: "monthly",
      static: "monthly",
    };
  }

  
  generateSlug(name) {
    if (!name) return "";
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  
  formatDate(date) {
    if (!date) return new Date().toISOString();
    return new Date(date).toISOString();
  }

  
  getProductUrl(product) {
    const slug = this.generateSlug(product.productName);
    return `${this.baseUrl}/product/${product.productId}/${slug}`;
  }

  
  getCategoryUrl(category) {
    const slug = this.generateSlug(category.name);
    return `${this.baseUrl}/category/${category._id}/${slug}`;
  }

  
  getSubCategoryUrl(subCategory, category) {
    const subSlug = this.generateSlug(subCategory.name);
    const catSlug = category ? this.generateSlug(category.name) : "category";
    return `${this.baseUrl}/category/${catSlug}/${subCategory._id}/${subSlug}`;
  }

  
  getBlogUrl(blog) {
    return `${this.baseUrl}/blog/${blog.slug}`;
  }

  
  getStaticPageUrl(slug) {
    return `${this.baseUrl}/${slug}`;
  }

  
  buildUrlEntry(loc, lastmod, changefreq, priority) {
    return `
    <url>
      <loc>${this.escapeXml(loc)}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>${changefreq}</changefreq>
      <priority>${priority}</priority>
    </url>`;
  }

  
  escapeXml(unsafe) {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  
  async getActiveProducts() {
    try {
      const products = await Product.find({ status: "active" })
        .select("productId productName updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean();

      return products.map((product) => ({
        loc: this.getProductUrl(product),
        lastmod: this.formatDate(product.updatedAt || product.createdAt),
        changefreq: this.defaultChangeFreq.product,
        priority: this.defaultPriority.product,
      }));
    } catch (error) {
      logger.error({
        event: "SITEMAP_PRODUCTS_FETCH_ERROR",
        error: error.message,
      });
      return [];
    }
  }

  
  async getActiveCategories() {
    try {
      const categories = await ProductCategory.find({ status: "active" })
        .select("name _id updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean();

      return categories.map((category) => ({
        loc: this.getCategoryUrl(category),
        lastmod: this.formatDate(category.updatedAt || category.createdAt),
        changefreq: this.defaultChangeFreq.category,
        priority: this.defaultPriority.category,
      }));
    } catch (error) {
      logger.error({
        event: "SITEMAP_CATEGORIES_FETCH_ERROR",
        error: error.message,
      });
      return [];
    }
  }

  
  async getActiveSubCategories() {
    try {
      const subCategories = await SubProductCategory.find()
        .populate("category", "name _id")
        .select("name category updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean();

      return subCategories
        .filter((sub) => sub.category && sub.category.name)
        .map((subCategory) => ({
          loc: this.getSubCategoryUrl(subCategory, subCategory.category),
          lastmod: this.formatDate(
            subCategory.updatedAt || subCategory.createdAt
          ),
          changefreq: this.defaultChangeFreq.subCategory,
          priority: this.defaultPriority.subCategory,
        }));
    } catch (error) {
      logger.error({
        event: "SITEMAP_SUBCATEGORIES_FETCH_ERROR",
        error: error.message,
      });
      return [];
    }
  }

  
  async getPublishedBlogs() {
    try {
      const blogs = await Blog.find()
        .select("slug updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean();

      return blogs.map((blog) => ({
        loc: this.getBlogUrl(blog),
        lastmod: this.formatDate(blog.updatedAt || blog.createdAt),
        changefreq: this.defaultChangeFreq.blog,
        priority: this.defaultPriority.blog,
      }));
    } catch (error) {
      logger.error({
        event: "SITEMAP_BLOGS_FETCH_ERROR",
        error: error.message,
      });
      return [];
    }
  }

  
  getStaticPages() {
    const staticPages = [
      { slug: "", priority: this.defaultPriority.home },
      { slug: "about", priority: this.defaultPriority.static },
      { slug: "contact", priority: this.defaultPriority.static },
      { slug: "privacy-policy", priority: this.defaultPriority.static },
      { slug: "terms-conditions", priority: this.defaultPriority.static },
      { slug: "refund-policy", priority: this.defaultPriority.static },
      { slug: "return-policy", priority: this.defaultPriority.static },
      { slug: "shipping-policy", priority: this.defaultPriority.static },
      { slug: "faq", priority: this.defaultPriority.static },
    ];

    return staticPages.map((page) => ({
      loc: this.getStaticPageUrl(page.slug),
      lastmod: this.formatDate(new Date()),
      changefreq: this.defaultChangeFreq.static,
      priority: page.priority,
    }));
  }

  
  async getSeoPages() {
    try {
      const seoPages = await SeoPage.find()
        .select("slug updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean();

      return seoPages.map((page) => ({
        loc: this.getStaticPageUrl(page.slug),
        lastmod: this.formatDate(page.updatedAt || page.createdAt),
        changefreq: this.defaultChangeFreq.static,
        priority: this.defaultPriority.static,
      }));
    } catch (error) {
      logger.error({
        event: "SITEMAP_SEO_PAGES_FETCH_ERROR",
        error: error.message,
      });
      return [];
    }
  }

  
  async generateSitemap() {
    try {
      logger.info({ event: "SITEMAP_GENERATION_STARTED" });

      const [
        products,
        categories,
        subCategories,
        blogs,
        seoPages,
      ] = await Promise.all([
        this.getActiveProducts(),
        this.getActiveCategories(),
        this.getActiveSubCategories(),
        this.getPublishedBlogs(),
        this.getSeoPages(),
      ]);

      const staticPages = this.getStaticPages();

      const allUrls = [
        ...staticPages,
        ...categories,
        ...subCategories,
        ...products,
        ...blogs,
        ...seoPages,
      ];

      logger.info({
        event: "SITEMAP_GENERATION_COMPLETED",
        totalUrls: allUrls.length,
        products: products.length,
        categories: categories.length,
        subCategories: subCategories.length,
        blogs: blogs.length,
        staticPages: staticPages.length,
        seoPages: seoPages.length,
      });

      return allUrls;
    } catch (error) {
      logger.error({
        event: "SITEMAP_GENERATION_ERROR",
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  
  async generateSitemapXml() {
    const urls = await this.generateSitemap();

    const urlEntries = urls
      .map((url) =>
        this.buildUrlEntry(url.loc, url.lastmod, url.changefreq, url.priority)
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;
  }

    async generateSitemapIndex(sitemapFiles) {
    const sitemapEntries = sitemapFiles
      .map(
        (file) => `
  <sitemap>
    <loc>${this.escapeXml(`${this.baseUrl}/sitemap-${file}.xml`)}</loc>
    <lastmod>${this.formatDate(new Date())}</lastmod>
  </sitemap>`
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
  }

  
  async generatePaginatedSitemaps() {
    const allUrls = await this.generateSitemap();
    const sitemaps = [];
    const totalSitemaps = Math.ceil(allUrls.length / this.maxUrlsPerSitemap);

    for (let i = 0; i < totalSitemaps; i++) {
      const start = i * this.maxUrlsPerSitemap;
      const end = start + this.maxUrlsPerSitemap;
      const urls = allUrls.slice(start, end);

      const urlEntries = urls
        .map((url) =>
          this.buildUrlEntry(
            url.loc,
            url.lastmod,
            url.changefreq,
            url.priority
          )
        )
        .join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;

      sitemaps.push({
        index: i + 1,
        xml,
        urlCount: urls.length,
      });
    }

    return sitemaps;
  }
}

module.exports = new SitemapService();

