const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { io } = require("../socket/socketServer");
const { Notification } = require("../models");

const addNotification = async (notificationBody) => {
  try {
    return await Notification.create(notificationBody);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getNotificationById = async (id) => {
  try {
    return await Notification.findById(id);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getNotifications = async (filter, options, userId) => {
  try {
    const notifications = await Notification.paginate(
      { ...filter, participants: { $in: [userId] } }, // Use $in to check if userId is in the array
      options
    );

    return notifications;
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getNotificationByParticipants = async (participants) => {
  const notification = await Notification.findOne({
    participants: { $in: [participants] },
  });
  return notification;
};

const getALLNotificationAdmin = async (filter, options) => {
  try {
    const notifications = await Notification.paginate(filter, options);
    const totalUnreadNotifications = await Notification.countDocuments({
      viewStatus: false,
    });

    return {
      notifications,
      totalUnreadNotifications,
    };
  } catch (error) {
    // Handle error
    console.error(error);
    return { notifications: [], totalUnreadNotifications: 0 }; // or throw error or handle as appropriate
  }
};

const getALLNotificationAdminSocket = async () => {
  try {
    const filter = { role: "admin" };
    const createdAtFilter = filter.createdAt
      ? { createdAt: filter.createdAt }
      : {};
    const query = {
      ...filter,
      ...createdAtFilter,
    };

    const sortingCriteria = { createdAt: -1 }; // Sort in descending order (newest first)

    const page = 1;
    const limit = 10;

    const skip = (page - 1) * limit;
    const updatedOptions = {
      sort: sortingCriteria,
      limit,
      skip,
    };

    const notifications = await Notification.find(query, null, updatedOptions);

    const totalUnreadNotifications = await Notification.countDocuments({
      ...query,
      viewStatus: false,
    });

    return {
      notifications,
      totalUnreadNotifications,
    };
  } catch (error) {
    // Handle error
    console.error(error);
    return { notifications: [], totalUnreadNotifications: 0 }; // or throw error or handle as appropriate
  }
};

const deleteNotificationById = async (id) => {
  const notifications = await Notification.findByIdAndDelete(id);
  return notifications;
};

const readNotification = async (id) => {
  const notifications = await Notification.findByIdAndUpdate(id, {
    viewStatus: true,
  });
  if (!notifications) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }
  return notifications;
};

// Flip every unread notification for the given user to viewStatus=true.
// Idempotent — returns the number of rows actually changed.
const readAllNotifications = async (userId) => {
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Sign in required");
  }
  const result = await Notification.updateMany(
    {
      $or: [{ userId }, { receiverId: userId }],
      viewStatus: false,
    },
    { $set: { viewStatus: true } }
  );
  return { modified: result.modifiedCount || 0 };
};

const getALLNotification = async (filter, options, userId) => {
  try {
    const { page = 1, limit = 10 } = options;

    // Count total number of notifications
    const totalCount = await Notification.countDocuments({
      $or: [{ userId }, { receiverId: userId }],
      ...filter,
    });

    // Count total number of notifications with viewStatus: false
    const unReadCount = await Notification.countDocuments({
      $or: [{ userId }, { receiverId: userId }],
      viewStatus: false,
      ...filter,
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Determine the number of documents to skip
    const skip = (page - 1) * limit;

    // Perform query to retrieve paginated notifications
    const results = await Notification.find({
      $or: [{ userId }, { receiverId: userId }],
      ...filter,
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      results,
      page,
      limit,
      totalPages,
      totalResults: totalCount,
      unReadCount,
    };
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const getALLAdminNotification = async (filter, options) => {
  try {
    const { page = 1, limit = 10 } = options;
    filter = { ...filter, role: "admin" };

    // Count total number of notifications
    const totalCount = await Notification.countDocuments({
      ...filter,
    });

    // Count total number of notifications with viewStatus: false
    const unReadCount = await Notification.countDocuments({
      viewStatus: false,
      ...filter,
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Determine the number of documents to skip
    const skip = (page - 1) * limit;

    // Perform query to retrieve paginated notifications
    const results = await Notification.find({
      ...filter,
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      results,
      page,
      limit,
      totalPages,
      totalResults: totalCount,
      unReadCount,
    };
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const addCustomNotification = async (eventName, userId, notifications) => {
  const messageEvent = `${eventName}::${userId}`;
  const result = await addNotification(notifications);

  if (eventName === "admin-notification") {
    // Push to every connected admin so the bell updates live.
    try {
      io.to("admins").emit("admin-notification", {
        message: "Notifications",
        status: "OK",
        statusCode: httpStatus.OK,
        data: result,
      });
      io.emit(messageEvent, {
        message: "Notifications",
        status: "OK",
        statusCode: httpStatus.OK,
        data: result,
      });
    } catch (_) {}
    return result;
  }

  const filter = {};
  const options = { limit: 10, sortBy: "createdAt:desc" };
  const notificationsAll = await getALLNotification(filter, options, userId);

  io.emit(messageEvent, {
    message: "Notifications",
    status: "OK",
    statusCode: httpStatus.OK,
    data: notificationsAll,
  });
  return result;
};

const readNotificationAdmin = async (id) => {
  const notifications = await Notification.findByIdAndUpdate(id, {
    viewStatus: true,
  });
  if (!notifications) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }
  return notifications;
};

module.exports = {
  addNotification,
  getNotifications,
  getNotificationById,
  getNotificationByParticipants,
  getALLNotification,
  getALLNotificationAdmin,
  deleteNotificationById,
  readNotification,
  readAllNotifications,
  getALLNotificationAdminSocket,
  addCustomNotification,
  getALLAdminNotification,
  readNotificationAdmin,
};
