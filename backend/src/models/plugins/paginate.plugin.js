const paginate = (schema) => {
  schema.statics.paginate = async function (filter, options) {
    let sort = "";
    if (options.sortBy) {
      const sortingCriteria = [];
      options.sortBy.split(",").forEach((sortOption) => {
        const [key, order] = sortOption.split(":");
        sortingCriteria.push((order === "desc" ? "-" : "") + key);
      });
      sort = sortingCriteria.join(" ");
    } else {
      sort = "createdAt";
    }

    const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
    const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
    const skip = (page - 1) * limit;

    const countPromise = this.countDocuments(filter).exec();
    let query = this.find(filter).sort(sort).skip(skip).limit(limit);

    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach((popOption) => {
          query = query.populate(popOption);
        });
      } else if (typeof options.populate === "string") {
        // Comma-separated paths (e.g. "orderId,initiatorId") — same
        // convention as the nestjs-paginate style used across services.
        options.populate.split(",").forEach((populateOption) => {
          const path = populateOption.trim();
          if (path) query = query.populate(path);
        });
      } else if (typeof options.populate === "object") {
        query = query.populate(options.populate);
      }
    }

    const [totalResults, results] = await Promise.all([countPromise, query.exec()]);
    return {
      results,
      page,
      limit,
      totalPages: Math.ceil(totalResults / limit),
      totalResults,
    };
  };
};

module.exports = paginate;
