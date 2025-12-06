const addressService = require("../services/addressService");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// loggedin customer

exports.addAddress = async (req, res) => {
  try {
    const result = await addressService.addAddress(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.getAddresses = async (req, res) => {
  try {
    const result = await addressService.getAddresses(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const result = await addressService.updateAddress(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const result = await addressService.deleteAddress(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

// guest customer

exports.addGuestAddress = async (req, res) => {
  try {
    const result = await addressService.addGuestAddress(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.getGuestAddresses = async (req, res) => {
  try {
    const result = await addressService.getGuestAddresses(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.updateGuestAddress = async (req, res) => {
  try {
    const result = await addressService.updateGuestAddress(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.deleteGuestAddress = async (req, res) => {
  try {
    const result = await addressService.deleteGuestAddress(req);
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.mergeGuestAddresses = async (req, res) => {
  try {
    const addresses = await addressService.mergeGuestAddresses(req);
    successResponse(res, addresses || []);
  } catch (err) {
    errorResponse(res, err);
  }
};

