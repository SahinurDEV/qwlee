import { baseApi } from "../api/baseApi";

const quickRepliesApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getQuickReplies: b.query({ query: () => "/quick-replies", transformResponse: (r) => r?.data?.attributes?.results || [], providesTags: ["QuickReplies"] }),
    saveQuickReply: b.mutation({
      query: ({ id, title, body }) => ({ url: id ? `/quick-replies/${id}` : "/quick-replies", method: id ? "PATCH" : "POST", body: { title, body } }),
      invalidatesTags: ["QuickReplies"],
    }),
    deleteQuickReply: b.mutation({ query: (id) => ({ url: `/quick-replies/${id}`, method: "DELETE" }), invalidatesTags: ["QuickReplies"] }),
    markThreadRead: b.mutation({ query: (chatId) => ({ url: "/message/read", method: "POST", body: { chatId } }) }),
  }),
});

export const { useGetQuickRepliesQuery, useSaveQuickReplyMutation, useDeleteQuickReplyMutation, useMarkThreadReadMutation } = quickRepliesApi;
