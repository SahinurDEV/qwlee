// Seller dashboard data hooks — Fiverr-style level overview + my-gigs
// with stats. Both endpoints are seller-scoped on the backend (auth
// middleware enforces role=freelancer), so the hooks just need the
// access token from the cookie (handled by baseApi).

import { baseApi } from "../api/baseApi";

const sellerLevelApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyLevelOverview: builder.query({
      query: () => ({
        url: "/gig/mine/level",
        method: "GET",
      }),
      transformResponse: (res) => res?.data?.attributes,
      providesTags: ["SingeUser"],
    }),
    getGigSuccessScore: builder.query({
      query: (gigId) => ({ url: `/gig/${gigId}/success-score`, method: "GET" }),
      transformResponse: (res) => res?.data?.attributes,
    }),
    getMyGigsStats: builder.query({
      query: () => ({
        url: "/gig/mine/stats",
        method: "GET",
      }),
      transformResponse: (res) => res?.data?.attributes,
      providesTags: ["Gigs"],
    }),
    bumpGigImpression: builder.mutation({
      query: (gigId) => ({
        url: `/gig/${gigId}/impression`,
        method: "POST",
      }),
    }),
    bumpGigClick: builder.mutation({
      query: (gigId) => ({
        url: `/gig/${gigId}/click`,
        method: "POST",
      }),
    }),
  }),
});

export const {
  useGetMyLevelOverviewQuery,
  useGetMyGigsStatsQuery,
  useGetGigSuccessScoreQuery,
  useBumpGigImpressionMutation,
  useBumpGigClickMutation,
} = sellerLevelApi;
