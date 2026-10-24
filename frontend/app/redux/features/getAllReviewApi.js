import { baseApi } from "../api/baseApi";

const getAllReviewApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllReviewApi: builder.query({
      query: ({ userId, gigId, rating, sort, withReply, limit, page }) => {
        let queryString = "/reviews";
        // Check if there are any query parameters
        const params = new URLSearchParams();
        if (userId) params.append("userId", userId);
        if (gigId) params.append("gigId", gigId);
        if (rating) params.append("rating", rating);
        if (sort) params.append("sort", sort);
        if (withReply) params.append("withReply", "true");
        if (limit) params.append("limit", limit);
        if (page) params.append("page", page);

        // If params exist, append to the URL
        if (params.toString()) {
          queryString += `?${params.toString()}`;
        }

        return {
          url: queryString,
          method: "GET",
        };
      },
      providesTags: ["GigReviews"],
    }),
  }),
});

export const { useGetAllReviewApiQuery } = getAllReviewApi;
