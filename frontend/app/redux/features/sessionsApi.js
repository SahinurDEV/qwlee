import { baseApi } from "../api/baseApi";

const sessionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSessions: builder.query({
      query: () => "/sessions",
      transformResponse: (r) => r?.data?.attributes?.results || [],
      keepUnusedDataFor: 0,
    }),
    revokeSession: builder.mutation({ query: (sid) => ({ url: `/sessions/${sid}`, method: "DELETE" }) }),
    revokeOtherSessions: builder.mutation({ query: () => ({ url: "/sessions/revoke-others", method: "POST" }) }),
  }),
});

export const { useGetSessionsQuery, useRevokeSessionMutation, useRevokeOtherSessionsMutation } = sessionsApi;
