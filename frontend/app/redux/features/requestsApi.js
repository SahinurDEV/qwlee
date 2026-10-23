import { baseApi } from "../api/baseApi";

const attrs = (res) => res?.data?.attributes ?? res?.data;

const requestsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOpenRequests: builder.query({
      query: ({ category, search, page = 1, limit = 20 } = {}) => ({
        url: "/requests",
        params: { ...(category ? { category } : {}), ...(search ? { search } : {}), page, limit },
      }),
      transformResponse: attrs,
      providesTags: ["Requests"],
    }),
    getMyRequests: builder.query({
      query: ({ page = 1 } = {}) => ({ url: "/requests/mine", params: { page, limit: 50 } }),
      transformResponse: attrs,
      providesTags: ["Requests"],
    }),
    getMyRequestOffers: builder.query({
      query: ({ page = 1 } = {}) => ({ url: "/requests/offers/mine", params: { page, limit: 50 } }),
      transformResponse: attrs,
      providesTags: ["Requests"],
    }),
    getRequest: builder.query({
      query: (id) => `/requests/${id}`,
      transformResponse: attrs,
      providesTags: ["Requests"],
    }),
    createRequest: builder.mutation({
      query: (body) => ({ url: "/requests", method: "POST", body }),
      transformResponse: attrs,
      invalidatesTags: ["Requests"],
    }),
    updateRequest: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/requests/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Requests"],
    }),
    sendRequestOffer: builder.mutation({
      query: ({ requestId, ...body }) => ({ url: `/requests/${requestId}/offers`, method: "POST", body }),
      invalidatesTags: ["Requests", "Credits"],
    }),
    getMyCredits: builder.query({
      query: () => "/requests/credits/me",
      transformResponse: attrs,
      providesTags: ["Credits"],
    }),
    buyCredits: builder.mutation({
      query: (packs) => ({ url: "/requests/credits/buy", method: "POST", body: { packs } }),
      transformResponse: attrs,
      invalidatesTags: ["Credits"],
    }),
    withdrawRequestOffer: builder.mutation({
      query: (offerId) => ({ url: `/requests/offers/${offerId}/withdraw`, method: "POST" }),
      invalidatesTags: ["Requests"],
    }),
    declineRequestOffer: builder.mutation({
      query: (offerId) => ({ url: `/requests/offers/${offerId}/decline`, method: "POST" }),
      invalidatesTags: ["Requests"],
    }),
  }),
});

export const {
  useGetOpenRequestsQuery,
  useGetMyRequestsQuery,
  useGetMyRequestOffersQuery,
  useGetRequestQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
  useSendRequestOfferMutation,
  useWithdrawRequestOfferMutation,
  useDeclineRequestOfferMutation,
  useGetMyCreditsQuery,
  useBuyCreditsMutation,
} = requestsApi;
