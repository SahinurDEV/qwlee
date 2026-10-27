import { baseApi } from "../api/baseApi";

const postGigVideoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    postGigVideo: builder.mutation({
      query: ({ gigId, formData }) => ({
        url: gigId ? `/gig/video?gigId=${gigId}` : `/gig/video`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Gigs", "updateGig"],
    }),
  }),
});

export const { usePostGigVideoMutation } = postGigVideoApi;
