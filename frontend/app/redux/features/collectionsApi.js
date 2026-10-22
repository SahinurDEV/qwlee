import { baseApi } from "../api/baseApi";

const collectionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCollections: builder.query({
      query: () => "/collections",
      transformResponse: (r) => r?.data?.attributes?.results || [],
      providesTags: ["ReactLove"],
    }),
    moveToCollection: builder.mutation({
      query: ({ gigId, collection }) => ({ url: "/collections/item", method: "PATCH", body: { gigId, collection } }),
      invalidatesTags: ["ReactLove"],
    }),
    renameCollection: builder.mutation({
      query: ({ from, to }) => ({ url: "/collections/rename", method: "PATCH", body: { from, to } }),
      invalidatesTags: ["ReactLove"],
    }),
    deleteCollection: builder.mutation({
      query: (name) => ({ url: `/collections?name=${encodeURIComponent(name)}`, method: "DELETE" }),
      invalidatesTags: ["ReactLove"],
    }),
    getRecommended: builder.query({
      query: ({ seen = [] } = {}) => `/collections/recommended?limit=8${seen.length ? `&seen=${seen.slice(0, 20).join(",")}` : ""}`,
      transformResponse: (r) => r?.data?.attributes || { results: [] },
    }),
  }),
});

export const {
  useGetCollectionsQuery,
  useMoveToCollectionMutation,
  useRenameCollectionMutation,
  useDeleteCollectionMutation,
  useGetRecommendedQuery,
} = collectionsApi;
