import { baseApi } from "@/app/redux/api/baseApi";

const welcomeApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getMyWelcome: b.query({
      query: () => "/growth/welcome/me",
      transformResponse: (r) => r?.data?.attributes || null,
    }),
  }),
});

export const { useGetMyWelcomeQuery } = welcomeApi;
