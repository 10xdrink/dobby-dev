const logger = require("../config/logger");
const crypto = require("crypto");

/**
 * Centralized Auth Logging Utility
 * Provides consistent logging across auth flows
 */

class AuthLogger {
  /**
   * Log signup OTP request
   */
  static signupOtpRequest(data) {
    logger.info({
      event: "SIGNUP_OTP_REQUEST",
      requestId: data.requestId,
      email: data.email,
      phone: data.phone,
      hasRef: !!data.ref,
      ip: data.ip,
      userAgent: data.userAgent
    });
  }

  /**
   * Log validation failures
   */
  static validationFailed(requestId, errors) {
    logger.warn({
      requestId,
      event: "VALIDATION_FAILED",
      errors: errors.map(e => ({ field: e.param, message: e.msg }))
    });
  }

  /**
   * Log existing user found during signup
   */
  static userAlreadyExists(requestId, userId) {
    logger.warn({
      requestId,
      event: "USER_ALREADY_EXISTS",
      userId
    });
  }

  /**
   * Log OTP generation
   */
  static otpGenerated(requestId, expiry) {
    logger.info({
      requestId,
      event: "OTP_GENERATED",
      expiryAt: expiry.toISOString()
    });
  }

  /**
   * Log signup data stored
   */
  static signupDataStored(requestId, otpDocId, hasEmail, hasPhone, hasRef) {
    logger.info({
      requestId,
      event: "SIGNUP_DATA_STORED_TEMPORARILY",
      otpDocId,
      hasEmail,
      hasPhone,
      hasRef
    });
  }

  /**
   * Log OTP sent
   */
  static otpSent(requestId, channel, success) {
    logger.info({
      requestId,
      event: "OTP_SENT",
      channel, // 'email' or 'sms'
      success
    });
  }

  /**
   * Log OTP verification attempt
   */
  static otpVerificationAttempt(requestId, otpDocId) {
    logger.info({
      requestId,
      event: "OTP_VERIFICATION_ATTEMPT",
      otpDocId
    });
  }

  /**
   * Log invalid OTP
   */
  static invalidOtp(requestId, reason) {
    logger.warn({
      requestId,
      event: "OTP_VERIFICATION_FAILED",
      reason // 'not_found', 'expired', 'wrong_code', 'blocked'
    });
  }

  /**
   * Log user created after OTP verification
   */
  static userCreated(requestId, userId, verified) {
    logger.info({
      requestId,
      event: "USER_CREATED_AFTER_VERIFICATION",
      userId,
      emailVerified: verified.email,
      phoneVerified: verified.phone
    });
  }

  /**
   * Log user verified (existing user)
   */
  static userVerified(requestId, userId) {
    logger.info({
      requestId,
      event: "EXISTING_USER_VERIFIED",
      userId
    });
  }

  /**
   * Log profile completion attempt
   */
  static profileCompletionAttempt(requestId, userId) {
    logger.info({
      requestId,
      event: "PROFILE_COMPLETION_ATTEMPT",
      userId
    });
  }

  /**
   * Log unverified profile completion attempt
   */
  static unverifiedProfileAttempt(requestId, userId) {
    logger.warn({
      requestId,
      event: "PROFILE_COMPLETION_BLOCKED",
      reason: "USER_NOT_VERIFIED",
      userId
    });
  }

  /**
   * Log profile completed
   */
  static profileCompleted(requestId, userId, shopName) {
    logger.info({
      requestId,
      event: "PROFILE_COMPLETED",
      userId,
      shopName
    });
  }

  /**
   * Log admin notification sent
   */
  static adminNotificationSent(requestId, userId) {
    logger.info({
      requestId,
      event: "ADMIN_NOTIFICATION_SENT",
      userId
    });
  }

  /**
   * Log login attempt
   */
  static loginAttempt(requestId, identifier, ip, userAgent) {
    logger.info({
      requestId,
      event: "LOGIN_ATTEMPT",
      identifier: identifier.includes("@") ? "email" : "phone",
      ip,
      userAgent
    });
  }

  /**
   * Log user not found during login
   */
  static loginUserNotFound(requestId, identifier) {
    logger.warn({
      requestId,
      event: "LOGIN_USER_NOT_FOUND",
      identifier: identifier.includes("@") ? "email" : "phone"
    });
  }

  /**
   * Log unverified user login attempt
   */
  static loginUnverified(requestId, userId) {
    logger.warn({
      requestId,
      event: "LOGIN_UNVERIFIED_USER",
      userId
    });
  }

  /**
   * Log login blocked (too many attempts)
   */
  static loginBlocked(requestId, userId, blockUntil) {
    logger.warn({
      requestId,
      event: "LOGIN_BLOCKED",
      userId,
      blockUntil: blockUntil.toISOString()
    });
  }

  /**
   * Log wrong password
   */
  static wrongPassword(requestId, userId, attempts) {
    logger.warn({
      requestId,
      event: "LOGIN_WRONG_PASSWORD",
      userId,
      attempts
    });
  }

  /**
   * Log blocked account login attempt
   */
  static accountBlocked(requestId, userId) {
    logger.warn({
      requestId,
      event: "LOGIN_ACCOUNT_BLOCKED",
      userId
    });
  }

  /**
   * Log pending approval login attempt
   */
  static accountPending(requestId, userId) {
    logger.warn({
      requestId,
      event: "LOGIN_ACCOUNT_PENDING_APPROVAL",
      userId
    });
  }

  /**
   * Log successful password validation
   */
  static loginPasswordValid(requestId, userId) {
    logger.info({
      requestId,
      event: "LOGIN_PASSWORD_VALID",
      userId
    });
  }

  /**
   * Log login OTP sent
   */
  static loginOtpSent(requestId, userId, channel) {
    logger.info({
      requestId,
      event: "LOGIN_OTP_SENT",
      userId,
      channel
    });
  }

  /**
   * Log login OTP verification success
   */
  static loginSuccess(requestId, userId) {
    logger.info({
      requestId,
      event: "LOGIN_SUCCESS",
      userId
    });
  }

  /**
   * Log logout
   */
  static logout(requestId, userId) {
    logger.info({
      requestId,
      event: "USER_LOGOUT",
      userId
    });
  }

  /**
   * Log general auth error
   */
  static authError(requestId, error, context) {
    logger.error({
      requestId,
      event: "AUTH_ERROR",
      error: error.message,
      stack: error.stack,
      context
    });
  }

  /**
   * Generate request ID
   */
  static generateRequestId() {
    return crypto.randomBytes(8).toString("hex");
  }
}

module.exports = AuthLogger;
