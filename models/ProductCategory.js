const mongoose = require("mongoose");

const productcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    logo: {
      type: String,
      required: false,
    },
    logoPublicId: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// productcategorySchema.post("save", async function (doc) {
//   try {
//     await CacheInvalidation.invalidateCategories(doc._id);
//     await CacheInvalidation.invalidateProducts();
//     logger.debug({
//       event: "CATEGORY_CACHE_INVALIDATED_ON_SAVE",
//       categoryId: doc._id,
//     });
//   } catch (err) {
//     logger.error({
//       event: "CATEGORY_CACHE_INVALIDATION_ERROR",
//       categoryId: doc._id,
//       error: err.message,
//     });
//   }
// });

// productcategorySchema.post("findOneAndUpdate", async function (doc) {
//   try {
//     await CacheInvalidation.invalidateCategories(doc?._id);
//     await CacheInvalidation.invalidateProducts();
//     logger.debug({
//       event: "CATEGORY_CACHE_INVALIDATED_ON_UPDATE",
//       categoryId: doc?._id,
//     });
//   } catch (err) {
//     logger.error({
//       event: "CATEGORY_CACHE_INVALIDATION_ERROR",
//       categoryId: doc?._id,
//       error: err.message,
//     });
//   }
// });

// productcategorySchema.post("deleteOne", { document: true }, async function (doc) {
//   try {
//     await CacheInvalidation.invalidateCategories(doc._id);
//     await CacheInvalidation.invalidateProducts();
//     logger.debug({
//       event: "CATEGORY_CACHE_INVALIDATED_ON_DELETE",
//       categoryId: doc._id,
//     });
//   } catch (err) {
//     logger.error({
//       event: "CATEGORY_CACHE_INVALIDATION_ERROR",
//       categoryId: doc._id,
//       error: err.message,
//     });
//   }
// });

module.exports = mongoose.model("ProductCategory", productcategorySchema);
