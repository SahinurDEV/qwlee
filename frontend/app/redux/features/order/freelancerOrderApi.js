const { baseApi } = require("../../api/baseApi");

const freelancerOrderApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFreelancerAllOrder: builder.query({
      query: (arg = {}) => {
        // Accept either a status string ("active") or { status, limit, page }.
        const { status, limit = 100, page = 1 } =
          typeof arg === "string" ? { status: arg } : arg || {};
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        if (limit) params.append("limit", limit);
        if (page) params.append("page", page);
        return {
          url: "/orders/freelancer",
          method: "GET",
          params,
        };
      },
      transformResponse: (data) => data?.data?.attributes,
      providesTags: ["Orders"],
    }),
    getOrderCounts: builder.query({
      query: (role = "buyer") => ({
        url: `/orders/counts?role=${role}`,
        method: "GET",
      }),
      transformResponse: (data) => data?.data?.attributes,
      providesTags: ["Orders"],
    }),
  }),
});

export const {
  useGetFreelancerAllOrderQuery,
  useGetOrderCountsQuery,
} = freelancerOrderApi;
