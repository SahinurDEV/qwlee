import { baseApi } from "../api/baseApi";

// kind: undefined = everything, "article" = blog posts, "guide" = how-tos.
const getAllBlogs = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllBlogs: builder.query({
      query: (kind) => (kind ? `/blog?kind=${kind}&sortBy=createdAt:desc` : `/blog?sortBy=createdAt:desc`),
    }),
  }),
});

export const { useGetAllBlogsQuery } = getAllBlogs;
