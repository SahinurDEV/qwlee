import { baseApi } from "../api/baseApi";

const getAllGigApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllGig: builder.query({
      query: (args = {}) => {
        const {
          categories,
          subCategory,
          minPrice,
          maxPrice,
          search,
          sortBy,
          limit,
          page,
          delivery,
          language,
          country,
          online,
          verifiedOnly,
          pro,
          minRating,
          level,
          minGigRating,
          minReviews,
          hasVideo,
        } = args;
        const params = new URLSearchParams();
        if (search) params.append("title", search);
        if (categories) {
          categories.forEach((category) => params.append("categories", category));
        }
        if (subCategory) params.append("subCategory", subCategory);
        if (maxPrice) params.append("maxPrice", maxPrice);
        if (minPrice) params.append("minPrice", minPrice);
        if (sortBy) params.append("sortBy", sortBy);
        if (limit) params.append("limit", limit);
        if (page) params.append("page", page);
        if (delivery) params.append("delivery", delivery);
        if (language) params.append("language", language);
        if (country) params.append("country", country);
        if (online) params.append("online", "true");
        if (verifiedOnly) params.append("verifiedOnly", "true");
        if (pro) params.append("pro", "true");
        if (minRating) params.append("minRating", minRating);
        if (level) params.append("level", level);
        if (minGigRating) params.append("minGigRating", minGigRating);
        if (minReviews) params.append("minReviews", minReviews);
        if (hasVideo) params.append("hasVideo", "true");
        return {
          url: "/gig",
          method: "GET",
          params,
        };
      },
      keepUnusedDataFor: 0,
      providesTags: ["Gigs"],
    }),
  }),
});

export const { useGetAllGigQuery } = getAllGigApi;
