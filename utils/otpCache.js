const otpCache = new Map();

setInterval(() => {
  otpCache.clear();
}, 15 * 60 * 1000);

module.exports = otpCache;
