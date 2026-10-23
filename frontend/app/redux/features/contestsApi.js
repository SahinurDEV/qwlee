import { baseApi } from "../api/baseApi";

const attrs = (r) => r?.data?.attributes ?? r?.data;
const post = (url, body) => ({ url, method: "POST", body });

const contestsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getContests: b.query({ query: (status = "open") => ({ url: "/contests", params: { status } }), transformResponse: attrs, providesTags: ["Contests"] }),
    getMyContests: b.query({ query: () => "/contests/mine", transformResponse: attrs, providesTags: ["Contests"] }),
    getContest: b.query({ query: (id) => `/contests/${id}`, transformResponse: attrs, providesTags: ["Contests"] }),
    createContest: b.mutation({ query: (body) => post("/contests", body), transformResponse: attrs, invalidatesTags: ["Contests"] }),
    contestAction: b.mutation({ query: ({ id, path, ...body }) => post(`/contests/${id}/${path}`, body), transformResponse: attrs, invalidatesTags: ["Contests"] }),
  }),
});

export const { useGetContestsQuery, useGetMyContestsQuery, useGetContestQuery, useCreateContestMutation, useContestActionMutation } = contestsApi;
