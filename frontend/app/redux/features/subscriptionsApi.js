import { baseApi } from "../api/baseApi";

const subscriptionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSubscriptions: builder.query({
      query: (role = "buyer") => `/subscriptions?role=${role}`,
      transformResponse: (r) => r?.data?.attributes?.results || [],
      providesTags: ["Subscriptions"],
    }),
    subscribe: builder.mutation({
      query: ({ gigId, packageName }) => ({ url: "/subscriptions", method: "POST", body: { gigId, packageName } }),
      invalidatesTags: ["Subscriptions", "Orders"],
    }),
    updateSubscription: builder.mutation({
      query: ({ id, action }) => ({ url: `/subscriptions/${id}`, method: "PATCH", body: { action } }),
      invalidatesTags: ["Subscriptions"],
    }),
    setGigSubscription: builder.mutation({
      query: ({ gigId, enabled, discountPercent }) => ({ url: `/subscriptions/gig/${gigId}`, method: "PUT", body: { enabled, discountPercent } }),
      invalidatesTags: ["Subscriptions", "Gigs"],
    }),
  }),
});

export const { useGetSubscriptionsQuery, useSubscribeMutation, useUpdateSubscriptionMutation, useSetGigSubscriptionMutation } = subscriptionsApi;
