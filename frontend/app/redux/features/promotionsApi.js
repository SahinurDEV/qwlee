import { baseApi } from "../api/baseApi";

const promotionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPromotions: builder.query({
      query: () => "/promotions",
      transformResponse: (r) => r?.data?.attributes || { results: [] },
      providesTags: ["Promotions"],
    }),
    createPromotion: builder.mutation({
      query: ({ gigId, days }) => ({ url: "/promotions", method: "POST", body: { gigId, days } }),
      invalidatesTags: ["Promotions"],
    }),
    cancelPromotion: builder.mutation({
      query: (id) => ({ url: `/promotions/${id}/cancel`, method: "POST" }),
      invalidatesTags: ["Promotions"],
    }),
  }),
});

export const { useGetPromotionsQuery, useCreatePromotionMutation, useCancelPromotionMutation } = promotionsApi;
