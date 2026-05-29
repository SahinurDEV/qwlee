const { baseApi } = require("../../api/baseApi");

const disputeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    openDispute: builder.mutation({
      query: (body) => ({
        url: "/disputes",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Orders", "Disputes"],
    }),
    getMyDisputes: builder.query({
      query: ({ status, page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        if (limit) params.append("limit", limit);
        if (page) params.append("page", page);
        return { url: "/disputes/my", method: "GET", params };
      },
      transformResponse: (data) => data?.data?.attributes,
      providesTags: ["Disputes"],
    }),
    getDisputeById: builder.query({
      query: (disputeId) => ({ url: `/disputes/${disputeId}`, method: "GET" }),
      transformResponse: (data) => data?.data?.attributes,
      providesTags: ["Disputes"],
    }),
    respondToDispute: builder.mutation({
      query: ({ disputeId, ...body }) => ({
        url: `/disputes/${disputeId}/respond`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Disputes"],
    }),
    escalateDispute: builder.mutation({
      query: (disputeId) => ({
        url: `/disputes/${disputeId}/escalate`,
        method: "POST",
      }),
      invalidatesTags: ["Disputes"],
    }),
    cancelDispute: builder.mutation({
      query: (disputeId) => ({
        url: `/disputes/${disputeId}/cancel`,
        method: "POST",
      }),
      invalidatesTags: ["Disputes", "Orders"],
    }),
  }),
});

export const {
  useOpenDisputeMutation,
  useGetMyDisputesQuery,
  useGetDisputeByIdQuery,
  useRespondToDisputeMutation,
  useEscalateDisputeMutation,
  useCancelDisputeMutation,
} = disputeApi;
