const DEFAULT_BASE_URL = process.env.FRONTEND_PROD || "https://test-dobby.vercel.app";
const DEFAULT_CURRENCY = "INR";

const sanitizeNumber = (value, digits = 2) => {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Number(num.toFixed(digits));
};

const clean = (value) => {
  if (Array.isArray(value)) {
    const cleanedArray = value
      .map((item) => clean(item))
      .filter((item) => item !== undefined);
    return cleanedArray.length ? cleanedArray : undefined;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).reduce((acc, [key, val]) => {
      const cleanedValue = clean(val);
      if (cleanedValue !== undefined) {
        acc[key] = cleanedValue;
      }
      return acc;
    }, {});

    return Object.keys(entries).length ? entries : undefined;
  }

  return value === undefined || value === null ? undefined : value;
};

exports.generateProductSchema = (product = {}) => {
  const baseUrl = DEFAULT_BASE_URL;
  const productId = product._id?.toString();
  const productUrl = productId ? `${baseUrl}/product/${productId}` : baseUrl;

  const images = clean(
    [
      product.metaImage,
      product.icon1,
      ...(Array.isArray(product.icon2) ? product.icon2 : []),
    ].filter(Boolean)
  );

  const offerPrice =
    sanitizeNumber(product.finalPrice) ?? sanitizeNumber(product.unitPrice);

  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": productId ? `${productUrl}#product` : undefined,
    name: product.metaTitle || product.productName,
    description: product.metaDescription || product.description,
    sku: product.sku,
    mpn: product.productId,
    category: product.category?.name,
    url: productUrl,
    image: images,
    brand: product.shop?.shopName
      ? {
          "@type": "Brand",
          name: product.shop.shopName,
          logo: product.shop.logo,
        }
      : undefined,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: product.currency || DEFAULT_CURRENCY,
      price: offerPrice,
      availability:
        product.currentStock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      priceValidUntil: new Date(
        new Date().setFullYear(new Date().getFullYear() + 1)
      ).toISOString(),
      seller: product.shop?.shopName
        ? {
            "@type": "Organization",
            name: product.shop.shopName,
            logo: product.shop.logo,
          }
        : undefined,
      inventoryLevel:
        product.currentStock !== undefined
          ? {
              "@type": "QuantitativeValue",
              value: product.currentStock,
            }
          : undefined,
      shippingDetails:
        product.shippingCost !== undefined
          ? {
              "@type": "OfferShippingDetails",
              shippingRate: {
                "@type": "MonetaryAmount",
                value: sanitizeNumber(product.shippingCost),
                currency: product.currency || DEFAULT_CURRENCY,
              },
              deliveryTime: {
                "@type": "ShippingDeliveryTime",
                handlingTime: {
                  "@type": "QuantitativeValue",
                  minValue: 1,
                  maxValue: 2,
                  unitCode: "d",
                },
                transitTime: {
                  "@type": "QuantitativeValue",
                  minValue: 2,
                  maxValue: 5,
                  unitCode: "d",
                },
              },
            }
          : undefined,
    },
    aggregateRating:
      product.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: sanitizeNumber(product.averageRating, 1),
            reviewCount: product.reviewCount,
          }
        : undefined,
  };

  return clean(schema);
};
