import { baseApi } from "../api/baseApi";

const attrs = (r) => r?.data?.attributes ?? r?.data;

const sellerPlanApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSellerPlan: builder.query({ query: () => "/users/me/plan", transformResponse: attrs, providesTags: ["SellerPlan"] }),
    subscribeSellerPlan: builder.mutation({
      query: (tier) => ({ url: "/users/me/plan", method: "POST", body: { tier } }),
      transformResponse: attrs,
      invalidatesTags: ["SellerPlan", "Credits"],
    }),
    cancelSellerPlan: builder.mutation({
      query: () => ({ url: "/users/me/plan/cancel", method: "POST" }),
      transformResponse: attrs,
      invalidatesTags: ["SellerPlan"],
    }),
  }),
});

export const { useGetSellerPlanQuery, useSubscribeSellerPlanMutation, useCancelSellerPlanMutation } = sellerPlanApi;
