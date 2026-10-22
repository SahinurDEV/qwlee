import { baseApi } from "../api/baseApi";

const getAllCategoryApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getAllCategory: builder.query({
            query: ({ search, sortBy, parentId, level, limit } = {}) => {
                const params = new URLSearchParams();
                if (search) params.set('name', search);
                if (sortBy) params.set('type', sortBy);
                if (parentId) params.set('parentId', parentId);
                if (level) params.set('level', level);
                if (limit) params.set('limit', limit);
                return {
                    url: '/categories',
                    params: params,
                    providesTags: ['Categories'],
                    params

                }
            },
            transformResponse: (res) => res?.data?.attributes,
        })
    })
})

export const { useGetAllCategoryQuery } = getAllCategoryApi;