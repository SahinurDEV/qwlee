import { baseApi } from "../api/baseApi";

const twoFactorApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTwoFactor: builder.query({
      query: () => "/two-factor",
      transformResponse: (r) => r?.data?.attributes || {},
      keepUnusedDataFor: 0,
    }),
    setupTwoFactor: builder.mutation({ query: () => ({ url: "/two-factor/setup", method: "POST" }) }),
    enableTwoFactor: builder.mutation({ query: (code) => ({ url: "/two-factor/enable", method: "POST", body: { code } }) }),
    disableTwoFactor: builder.mutation({ query: (code) => ({ url: "/two-factor/disable", method: "POST", body: { code } }) }),
  }),
});

export const { useGetTwoFactorQuery, useSetupTwoFactorMutation, useEnableTwoFactorMutation, useDisableTwoFactorMutation } = twoFactorApi;
