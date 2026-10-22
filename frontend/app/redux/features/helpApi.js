import { baseApi } from "../api/baseApi";

const helpApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHelp: builder.query({
      query: ({ q = "", category = "", audience = "" } = {}) => {
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        if (category) p.set("category", category);
        if (audience) p.set("audience", audience);
        return `/help?${p.toString()}`;
      },
      transformResponse: (r) => r?.data?.attributes || { results: [], categories: [] },
    }),
    getHelpArticle: builder.query({
      query: (slug) => `/help/${encodeURIComponent(slug)}`,
      transformResponse: (r) => r?.data?.attributes,
    }),
    helpFeedback: builder.mutation({
      query: ({ slug, helpful }) => ({ url: `/help/${encodeURIComponent(slug)}/feedback`, method: "POST", body: { helpful } }),
    }),
  }),
});

export const { useGetHelpQuery, useGetHelpArticleQuery, useHelpFeedbackMutation } = helpApi;
