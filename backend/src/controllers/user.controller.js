const { toPublicUser } = require("../utils/publicUser");
const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { userService } = require("../services");
const {
  validateUsernameFormat,
  ERRORS: USERNAME_ERRORS,
} = require("../validations/username.validation");
const { isReserved } = require("../utils/reservedUsernames");

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).json(
    response({
      message: "User Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: user,
    })
  );
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["fullName", "role", "username", "email"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const isAdmin = req.user?.role === "admin";
  const result = await userService.queryUsers(filter, options, { isAdmin });
  if (!isAdmin) {
    result.results = result.results.map(toPublicUser);
  }
  res.status(httpStatus.OK).json(
    response({
      message: "All Users",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getUser = catchAsync(async (req, res) => {
  let user = await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const isSelfOrAdmin =
    req.user && (req.user.role === "admin" || String(req.user.id) === String(user.id));
  if (!isSelfOrAdmin) user = toPublicUser(user);
  res.status(httpStatus.OK).json(
    response({
      message: "User",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user },
    })
  );
});

const updateUser = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updatedUserData = req.body; // Directly assign req.body to updatedUserData

  // Update user data
  const user = await userService.updateUserById(userId, updatedUserData);

  // Send response
  res.status(httpStatus.OK).json(
    response({
      message: "User Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: user,
    })
  );
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.OK).json(
    response({
      message: "User Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const allUsers = catchAsync(async (req, res) => {
  const users = await userService.allUsers();
  res.status(httpStatus.OK).json(
    response({
      message: "All Users",
      status: "OK",
      statusCode: httpStatus.OK,
      data: users,
    })
  );
});

// Lightweight availability probe used by the live signup form. Returns
// { available, reason } — never throws on "taken" / "reserved", since
// that's the expected unhappy path the UI needs to render.
const checkUsername = catchAsync(async (req, res) => {
  const raw = req.params.username || req.query.username;
  const check = validateUsernameFormat(raw);
  if (!check.ok) {
    return res.status(httpStatus.OK).json(
      response({
        message: "Username check",
        status: "OK",
        statusCode: httpStatus.OK,
        data: { available: false, reason: check.message },
      })
    );
  }
  if (isReserved(check.username)) {
    return res.status(httpStatus.OK).json(
      response({
        message: "Username check",
        status: "OK",
        statusCode: httpStatus.OK,
        data: { available: false, reason: USERNAME_ERRORS.RESERVED },
      })
    );
  }
  const taken = await userService.isUsernameTaken(check.username);
  res.status(httpStatus.OK).json(
    response({
      message: "Username check",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {
        available: !taken,
        reason: taken ? USERNAME_ERRORS.TAKEN : null,
        username: check.username,
      },
    })
  );
});

// Self-service role upgrade: a buyer flips themselves to a freelancer
// so they can list gigs. Admins cannot be flipped through this path.
const becomeSeller = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.user.id);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (user.role === "admin")
    throw new ApiError(httpStatus.FORBIDDEN, "Admins cannot become sellers");
  if (user.role === "freelancer") {
    return res.status(httpStatus.OK).json(
      response({
        message: "Already a seller",
        status: "OK",
        statusCode: httpStatus.OK,
        data: { user },
      })
    );
  }
  user.role = "freelancer";
  await user.save();
  res.status(httpStatus.OK).json(
    response({
      message: "You're now a Qwlee seller",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user },
    })
  );
});

const getUserPublicByUsername = catchAsync(async (req, res) => {
  const username = String(req.params.username || "").toLowerCase();
  if (!username) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Username is required");
  }
  const user = await userService.getPublicProfileByUsername(username);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  // Admin accounts don't have a public-facing storefront — hide them
  // behind a 404 so visiting /admin doesn't expose the admin profile.
  if (user.role === "admin") {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  res.status(httpStatus.OK).json(
    response({
      message: "User",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user },
    })
  );
});

const updateProfileImage = catchAsync(async (req, res) => {
  if (req.file?.cloudUrl) {
    req.body.image = req.file.cloudUrl;
  }

  const user = await userService.updateUserById(req.user.id, req.body);
  res.status(httpStatus.OK).json(
    response({
      message: "Profile Image Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: user,
    })
  );
});

const updateCoverImage = catchAsync(async (req, res) => {
  if (req.file?.cloudUrl) {
    req.body.coverImage = req.file.cloudUrl;
  }

  const user = await userService.updateUserById(req.user.id, req.body);
  res.status(httpStatus.OK).json(
    response({
      message: "Cover Image Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: user,
    })
  );
});
const getUsersPublicById = catchAsync(async (req, res) => {
  const user = await userService.getUsersPublicById(req.query.userId);
  res.status(httpStatus.OK).json(
    response({
      message: "User",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user },
    })
  );
});

const getUserStats = catchAsync(async (req, res) => {
  const {userId} = req.params;
  const stats = await userService.getUserStats(userId);
  res.status(httpStatus.OK).json(
    response({
      message: "User Stats",
      status: "OK",
      statusCode: httpStatus.OK,
      data: stats,
    })
  );
});

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  allUsers,
  updateProfileImage,
  getUsersPublicById,
  updateCoverImage,
  getUserStats,
  checkUsername,
  getUserPublicByUsername,
  becomeSeller,
};
