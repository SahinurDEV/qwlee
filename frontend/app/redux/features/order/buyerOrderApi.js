const { baseApi } = require("../../api/baseApi");

const buyerOrderApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createBuyerOrder: builder.mutation({
      query: (order) => ({
        url: "/orders/checkout",
        method: "POST",
        body: order,
      }),
    }),
    getBuyerAllOrder: builder.query({
      // Accept either a plain status string (legacy callers) or an
      // options object {status, limit, page}.
      query: (arg) => {
        const opts =
          typeof arg === "string" ? { status: arg } : arg || {};
        const { status, limit = 100, page = 1 } = opts;
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        if (limit) params.append("limit", limit);
        if (page) params.append("page", page);
        return { url: "/orders", method: "GET", params };
      },
      transformResponse: (data) => data?.data?.attributes,
      providesTags: ["Orders"],
    }),
    getBuyerOrderDetails: builder.query({
      query: (orderId) => ({
        url: `/orders/${orderId}`,
        method: "GET",
      }),
      transformResponse: (data) => data?.data?.attributes,
      providesTags: ["Orders"],
    }),
    updateBuyerOrderStatus: builder.mutation({
      query: ({ orderId, status, reason }) => ({
        url: `/orders?orderId=${orderId}`,
        method: "PATCH",
        body: { status, ...(reason ? { reason } : {}) },
      }),
      invalidatesTags: ["Orders"],
    }),
    getOrderQuote: builder.mutation({
      query: (body) => ({ url: "/orders/quote", method: "POST", body }),
      transformResponse: (data) => data?.data?.attributes,
    }),
    submitOrderRequirements: builder.mutation({
      query: ({ orderId, answers }) => ({
        url: `/orders/${orderId}/requirements`,
        method: "POST",
        body: { answers },
      }),
      invalidatesTags: ["Orders"],
    }),
    requestOrderRevision: builder.mutation({
      query: ({ orderId, reason }) => ({
        url: `/orders/${orderId}/revision`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: ["Orders", "OrderMessages"],
    }),
    requestOrderExtension: builder.mutation({
      query: ({ orderId, newDeliveryDate, reason }) => ({
        url: `/orders/${orderId}/extension`,
        method: "POST",
        body: { newDeliveryDate, reason },
      }),
      invalidatesTags: ["Orders", "OrderMessages"],
    }),
    askOrderUpdate: builder.mutation({
      query: ({ orderId, note }) => ({ url: `/orders/${orderId}/update-request`, method: "POST", body: { note } }),
      invalidatesTags: ["Orders"],
    }),
    answerOrderUpdate: builder.mutation({
      query: ({ orderId, reply }) => ({ url: `/orders/${orderId}/update-request`, method: "PATCH", body: { reply } }),
      invalidatesTags: ["Orders"],
    }),
    releaseMilestone: builder.mutation({
      query: ({ orderId, index }) => ({ url: `/orders/${orderId}/milestones/${index}/release`, method: "POST" }),
      invalidatesTags: ["Orders"],
    }),
    tipOrder: builder.mutation({
      query: ({ orderId, amount }) => ({ url: `/orders/${orderId}/tip`, method: "POST", body: { amount } }),
      invalidatesTags: ["Orders"],
    }),
    requestCancellation: builder.mutation({
      query: ({ orderId, reason }) => ({ url: `/orders/${orderId}/cancellation`, method: "POST", body: { reason } }),
      invalidatesTags: ["Orders"],
    }),
    respondCancellation: builder.mutation({
      query: ({ orderId, action }) => ({ url: `/orders/${orderId}/cancellation`, method: "PATCH", body: { action } }),
      invalidatesTags: ["Orders"],
    }),
    respondOrderExtension: builder.mutation({
      query: ({ orderId, action }) => ({
        url: `/orders/${orderId}/extension`,
        method: "PATCH",
        body: { action },
      }),
      invalidatesTags: ["Orders", "OrderMessages"],
    }),
  }),
});

export const {
  useAskOrderUpdateMutation,
  useAnswerOrderUpdateMutation,
  useCreateBuyerOrderMutation,
  useTipOrderMutation,
  useReleaseMilestoneMutation,
  useGetBuyerAllOrderQuery,
  useGetBuyerOrderDetailsQuery,
  useUpdateBuyerOrderStatusMutation,
  useRequestOrderExtensionMutation,
  useRespondOrderExtensionMutation,
  useRequestCancellationMutation,
  useRespondCancellationMutation,
  useGetOrderQuoteMutation,
  useSubmitOrderRequirementsMutation,
  useRequestOrderRevisionMutation,
} = buyerOrderApi;
