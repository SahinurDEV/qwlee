// Wishlist (gig love) endpoints.
//
// The list endpoint returns the user's loved gigs (populated). The love
// + unlove mutations invalidate "ReactLove" so the list re-fetches, and
// also apply optimistic updates so the heart flips instantly.

import { baseApi } from "../api/baseApi";

const getMyListApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyList: builder.query({
      query: () => ({ url: "/gig/love?limit=200", method: "GET" }),
      providesTags: ["ReactLove"],
    }),
    addToWishlist: builder.mutation({
      query: (gigId) => ({
        url: `/gig/love?gigId=${gigId}`,
        method: "POST",
      }),
      invalidatesTags: ["ReactLove"],
      // Optimistic insert: drop a temp record in the list so the heart
      // shows filled immediately. If the request fails we roll back.
      async onQueryStarted(gigId, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          getMyListApi.util.updateQueryData("getMyList", undefined, (draft) => {
            const list = draft?.data?.attributes?.results;
            if (!Array.isArray(list)) return;
            if (list.some((x) => (x.gigId?._id || x.gigId) === gigId)) return;
            list.unshift({ _id: `optimistic-${gigId}`, gigId: { _id: gigId } });
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    removeFromWishlist: builder.mutation({
      query: (gigId) => ({
        url: `/gig/love?gigId=${gigId}`,
        method: "PUT",
      }),
      invalidatesTags: ["ReactLove"],
      async onQueryStarted(gigId, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          getMyListApi.util.updateQueryData("getMyList", undefined, (draft) => {
            const list = draft?.data?.attributes?.results;
            if (!Array.isArray(list)) return;
            const i = list.findIndex((x) => (x.gigId?._id || x.gigId) === gigId);
            if (i >= 0) list.splice(i, 1);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useGetMyListQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
} = getMyListApi;
