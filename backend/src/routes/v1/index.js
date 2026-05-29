const express = require("express");
const config = require("../../config/config");
const authRoute = require("./auth.routes");
const userRoute = require("./user.routes");
const docsRoute = require("./docs.routes");
const gigRoute = require("./gig.routes");
const categoriesRoute = require("./categories.routes");
const blogRoute = require("./blog.routes");
const notificationRoute = require("./notification.routes");
const infoRoute = require("./info.routes");
const portfolioRoute = require("./portfolio.routes");
const reviewsRoute = require("./reviews.routes");
const ordersRoute = require("./orders.routes");
const withdrawalRoute = require("./withdrawal.routes");
const chatRoute = require("./chat.routes");
const messageRoute = require("./message.routes");
const adminRoute = require('./admin.routes');
const orderMessageRoute = require('./orderMessage.routes')
const bannerImageRoute = require('./banner.routes')
const activityRoute = require('./activity.routes')
const supportRoute = require('./support.routes')
const verificationRoute = require('./verification.routes')
const searchRoute = require('./search.routes')
const paymentsRoute = require('./payments.routes')
const disputeRoute = require('./dispute.routes')

const router = express.Router();

const defaultRoutes = [
  {
    path: "/auth",
    route: authRoute,
  },
  {
    path: "/users",
    route: userRoute,
  },

  {
    path: "/gig",
    route: gigRoute,
  },
  {
    path: "/categories",
    route: categoriesRoute,
  },
  {
    path: "/blog",
    route: blogRoute,
  },
  {
    path: "/notification",
    route: notificationRoute,
  },
  {
    path: "/info",
    route: infoRoute,
  },
  {
    path: "/portfolio",
    route: portfolioRoute,
  },
  {
    path: "/reviews",
    route: reviewsRoute,
  },
  {
    path: "/orders",
    route: ordersRoute,
  },
  {
    path: "/withdrawal",
    route: withdrawalRoute,
  },
  {
    path: "/chat",
    route: chatRoute,
  },
  {
    path: "/message",
    route: messageRoute,
  },
  {
    path: "/order-message",
    route: orderMessageRoute,
  },
  {
    path: "/admin",
    route: adminRoute,
  },
  {
    path: "/banner-image",
    route: bannerImageRoute,
  },
  {
    path: "/activity",
    route: activityRoute,
  },
  {
    path: "/support",
    route: supportRoute,
  },
  {
    path: "/verification",
    route: verificationRoute,
  },
  {
    path: "/search",
    route: searchRoute,
  },
  {
    path: "/payments",
    route: paymentsRoute,
  },
  {
    path: "/disputes",
    route: disputeRoute,
  }
];

const devRoutes = [
  // routes available only in development mode
  {
    path: "/docs",
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === "development") {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
