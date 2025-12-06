const Address = require("../models/Address");
const mongoose = require("mongoose");
const logger = require('../config/logger');


class AddressService {

    // loggedin customer

  async addAddress({ user, body }) {
    const customerId = user.id || user._id;
    if (!customerId) throw new Error("Customer not authenticated");

   
   if (body.isDefault) {
  await Address.updateMany(
    { customer: customerId, type: body.type || "shipping" },
    { $set: { isDefault: false } }
  );
}



    const newAddress = new Address({
  customer: customerId,
  ...body,
  type: body.type || "shipping" 
});

    await newAddress.save();

    logger.info(`Address created: addressId=${newAddress._id}, customerId=${customerId}`);

    return newAddress;
  }

  async getAddresses({ user, query = {}  }) {
    const customerId = user.id || user._id;
    if (!customerId) throw new Error("Customer not authenticated");

   const filter = { customer: customerId, isDeleted: false };

if (query.type) filter.type = query.type; 

const addresses = await Address.find(filter)
  .sort({ isDefault: -1, createdAt: -1 });

    return addresses;
  }

  async updateAddress({ user, params, body }) {
    const customerId = user.id || user._id;
    const addressId = params.id;

    const address = await Address.findOne({ _id: addressId, customer: customerId });
    if (!address) throw new Error("Address not found");

    if (body.isDefault) {
  await Address.updateMany(
    { customer: customerId, type: body.type || "shipping" },
    { $set: { isDefault: false } }
  );
}


    Object.assign(address, body);
    await address.save();

    logger.info(`Address updated: addressId=${addressId}, customerId=${customerId}, changes=${JSON.stringify(body)}`);
    return address;
  }

  async deleteAddress({ user, params }) {
  const customerId = user.id || user._id;
  const addressId = params.id;

  const address = await Address.findOneAndUpdate(
    { _id: addressId, customer: customerId, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!address) {
    logger.warn(`deleteAddress failed: Address not found or already deleted, id=${addressId}`);
    throw new Error("Address not found");
  }

  logger.info(`Address soft-deleted: addressId=${addressId}, customerId=${customerId}`);
  return { message: "Address deleted successfully (soft delete)" };
}


// guest customer

async addGuestAddress({ body, query }) {
    const { sessionId } = query;
   if (!sessionId) {
    logger.error('addGuestAddress failed: Session ID required');
    throw new Error("Session ID required");
  }

    if (body.isDefault) {
  await Address.updateMany(
    { sessionId, type: body.type || "shipping" },
    { $set: { isDefault: false } }
  );
}


    const newAddress = new Address({
  sessionId,
  ...body,
  type: body.type || "shipping"
});

    await newAddress.save();

    logger.info(`Guest address created: sessionId=${sessionId}, addressId=${newAddress._id}`);
    return newAddress;
  }

  async getGuestAddresses({ query }) {
    const { sessionId } = query;
    if (!sessionId) {
    logger.error('getGuestAddresses failed: Session ID required');
    throw new Error("Session ID required");
  }
   const filter = { sessionId, isDeleted: false };
if (query.type) filter.type = query.type;

const addresses = await Address.find(filter)
  .sort({ isDefault: -1, createdAt: -1 });

    logger.info(`Fetched ${addresses.length} guest addresses for sessionId=${sessionId}`);
    return addresses;
  }

  async updateGuestAddress({ params, body, query }) {
    const { sessionId } = query;
    const { id } = params;
    const address = await Address.findOne({ _id: id, sessionId });
   if (!address) {
    logger.error(`updateGuestAddress failed: Address not found, sessionId=${sessionId}, addressId=${id}`);
    throw new Error("Address not found");
  }

    if (body.isDefault) {
  await Address.updateMany(
    { sessionId, type: body.type || "shipping" },
    { $set: { isDefault: false } }
  );
}


    Object.assign(address, body);
    await address.save();

    logger.info(`Guest address updated: sessionId=${sessionId}, addressId=${id}, changes=${JSON.stringify(body)}`);
    return address;
  }

 async deleteGuestAddress({ params, query }) {
  const { sessionId } = query;
  const { id } = params;

  const address = await Address.findOneAndUpdate(
    { _id: id, sessionId, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!address) {
    logger.warn(`deleteGuestAddress failed: Address not found or already deleted, sessionId=${sessionId}, addressId=${id}`);
    throw new Error("Address not found");
  }

  logger.info(`Guest address soft-deleted: sessionId=${sessionId}, addressId=${id}`);
  return { message: "Guest address deleted successfully (soft delete)" };
}

  async mergeGuestAddresses({ user, query }) {
  const customerId = user.id || user._id;
  const { sessionId } = query;
  if (!sessionId) return null;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // reset defaults safely
    await Address.updateMany({ sessionId }, { isDefault: false }, { session });

    const guestAddresses = await Address.find({ sessionId, isDeleted: false }).session(session);
    if (!guestAddresses || guestAddresses.length === 0) {
      await session.commitTransaction();
      return null;
    }

    let mergedCount = 0;
    for (let addr of guestAddresses) {
      const exists = await Address.findOne({
        customer: customerId,
        isDeleted: false,
        addressLine: addr.addressLine,
        zipCode: addr.zipCode,
        city: addr.city,
        state: addr.state,
        country: addr.country,
      }).session(session);

      if (!exists) {
        addr.customer = customerId;
        addr.sessionId = null;
        await addr.save({ session });
        mergedCount++;
      } else {
        await Address.findByIdAndUpdate(addr._id, { isDeleted: true }, { session });
      }
    }

    // ensure default exists
    const hasDefault = await Address.exists({ customer: customerId, isDefault: true }).session(session);
    if (!hasDefault) {
      const firstMerged = await Address.findOne({ customer: customerId }).sort({ createdAt: 1 }).session(session);
      if (firstMerged) {
        firstMerged.isDefault = true;
        await firstMerged.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(`Merged guest addresses: customerId=${customerId}, sessionId=${sessionId}, mergedCount=${mergedCount}`);

    return await Address.find({ customer: customerId, isDeleted: false }).sort({ isDefault: -1, createdAt: -1 });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}



}




module.exports = new AddressService();
