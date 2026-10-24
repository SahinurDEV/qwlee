import { baseApi } from "@/app/redux/api/baseApi";

const clearanceApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getMyClearance: b.query({
      query: () => "/withdrawal/clearance",
      transformResponse: (r) => r?.data?.attributes || null,
    }),
  }),
});

export const { useGetMyClearanceQuery } = clearanceApi;
