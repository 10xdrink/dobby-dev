const sitemapController = require("../controllers/sitemapController");
const logger = require("../config/logger");




async function invalidateSitemapCache() {
  try {
    await sitemapController.invalidateCache();
    logger.info({ event: "SITEMAP_CACHE_AUTO_INVALIDATED" });
  } catch (error) {
    logger.error({
      event: "SITEMAP_CACHE_AUTO_INVALIDATION_ERROR",
      error: error.message,
    });
  }
}


function setupProductHooks(Product) {
  // Invalidate on product create/update/delete
  Product.schema.post("save", async function (doc) {
    if (doc.status === "active" || doc.status === "inactive") {
      await invalidateSitemapCache();
    }
  });

  Product.schema.post("findOneAndUpdate", async function (doc) {
    if (doc && (doc.status === "active" || doc.status === "inactive")) {
      await invalidateSitemapCache();
    }
  });

  Product.schema.post("deleteOne", { document: true }, async function (doc) {
    await invalidateSitemapCache();
  });
}


function setupCategoryHooks(ProductCategory) {
  ProductCategory.schema.post("save", async function (doc) {
    if (doc.status === "active" || doc.status === "inactive") {
      await invalidateSitemapCache();
    }
  });

  ProductCategory.schema.post("findOneAndUpdate", async function (doc) {
    if (doc && (doc.status === "active" || doc.status === "inactive")) {
      await invalidateSitemapCache();
    }
  });

  ProductCategory.schema.post("deleteOne", { document: true }, async function (doc) {
    await invalidateSitemapCache();
  });
}


function setupSubCategoryHooks(SubProductCategory) {
  SubProductCategory.schema.post("save", async function () {
    await invalidateSitemapCache();
  });

  SubProductCategory.schema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
      await invalidateSitemapCache();
    }
  });

  SubProductCategory.schema.post("deleteOne", { document: true }, async function () {
    await invalidateSitemapCache();
  });
}

function setupBlogHooks(Blog) {
  Blog.schema.post("save", async function () {
    await invalidateSitemapCache();
  });

  Blog.schema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
      await invalidateSitemapCache();
    }
  });

  Blog.schema.post("deleteOne", { document: true }, async function () {
    await invalidateSitemapCache();
  });
}


function setupSeoPageHooks(SeoPage) {
  SeoPage.schema.post("save", async function () {
    await invalidateSitemapCache();
  });

  SeoPage.schema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
      await invalidateSitemapCache();
    }
  });

  SeoPage.schema.post("deleteOne", { document: true }, async function () {
    await invalidateSitemapCache();
  });
}


function initializeSitemapHooks() {
  try {
    const Product = require("../models/productModel");
    const ProductCategory = require("../models/ProductCategory");
    const SubProductCategory = require("../models/SubProductCategory");
    const Blog = require("../models/Blog");
    const SeoPage = require("../models/SeoPage");

    setupProductHooks(Product);
    setupCategoryHooks(ProductCategory);
    setupSubCategoryHooks(SubProductCategory);
    setupBlogHooks(Blog);
    setupSeoPageHooks(SeoPage);

    logger.info({ event: "SITEMAP_HOOKS_INITIALIZED" });
  } catch (error) {
    logger.error({
      event: "SITEMAP_HOOKS_INITIALIZATION_ERROR",
      error: error.message,
    });
  }
}

module.exports = {
  initializeSitemapHooks,
  invalidateSitemapCache,
};

