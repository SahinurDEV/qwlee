import { baseApi } from "../../api/baseApi";

export const inboxApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    addMessage: builder.mutation({
      query: (messageBody) => ({
        url: "/message/add-message",
        method: "POST",
        body: messageBody,
      }),
      invalidatesTags: ["Messages", "Chat"],
    }),
    getMessages: builder.query({
      query: ({ chatId, page }) =>
        `/message/get-messages?chatId=${chatId}&page=${page}`,
      providesTags: ["Messages"],
      transformResponse: (response) => {
        return response?.data?.attributes;
      },
    }),
    getMoreMessages: builder.query({
      query: ({ chatId, page }) =>
        `/message/get-messages?chatId=${chatId}&page=${page}`,
      providesTags: ["Messages"],
      async onQueryStarted({ chatId }, { dispatch, queryFulfilled }) {
        const messages = await queryFulfilled;
        if (messages.data) {
          dispatch(
            baseApi.util.updateQueryData(
              "getMessages",
              chatId,
              (previousData) => {
                console.log("Get more messages", previousData);
              }
            )
          );
        }
      },
      transformResponse: (response) => {
        return response?.data?.attributes;
      },
    }),
    getChats: builder.query({
      query: (arg) => (arg?.archived ? `/chat/get-chat?archived=true` : `/chat/get-chat`),
      providesTags: ["Chat"],
      transformResponse: (response) => {
        return response?.data?.attributes;
      },
    }),
    // Get-or-create the chat between the current user and `receiverId`.
    // Backend returns the existing chat if one already exists, otherwise
    // creates a fresh one. Used by the public profile Contact button.
    startChatWithUser: builder.mutation({
      query: (receiverId) => ({
        url: "/chat/add-chat",
        method: "POST",
        body: { receiverId },
      }),
      invalidatesTags: ["Chat"],
      transformResponse: (response) => response?.data?.attributes,
    }),
    getChat: builder.query({
      query: (chatId) => `/chat/${chatId}`,
      transformResponse: (response) => {
        return response?.data?.attributes;
      },
    }),
    // Delete one message: scope "me" hides it for you, "everyone" wipes it.
    deleteMessage: builder.mutation({
      query: ({ id, scope = "me" }) => ({
        url: `/message/${id}${scope === "everyone" ? "?scope=everyone" : ""}`,
        method: "DELETE",
      }),
    }),
    // block | unblock | archive | unarchive | pin | unpin
    chatAction: builder.mutation({
      query: ({ chatId, action }) => ({
        url: `/chat/${chatId}`,
        method: "PATCH",
        body: { action },
      }),
      invalidatesTags: ["Chat"],
    }),
    reportChat: builder.mutation({
      query: ({ chatId, reason, note, block }) => ({
        url: `/chat/${chatId}/report`,
        method: "POST",
        body: { reason, note, block },
      }),
      invalidatesTags: ["Chat"],
    }),
    searchMessages: builder.query({
      query: ({ q, chatId }) =>
        `/message/search?q=${encodeURIComponent(q)}${chatId ? `&chatId=${chatId}` : ""}`,
      transformResponse: (response) => response?.data?.attributes?.results || [],
    }),
    getChatContext: builder.query({
      query: (chatId) => `/chat/${chatId}/context`,
      transformResponse: (response) => response?.data?.attributes?.orders || [],
    }),
    cancelOrWithdrawOffer: builder.mutation({
      query: (offerId) => ({
        url: `/message/${offerId}`,
        method: "PUT",
      }),
      invalidatesTags: ["Messages"],
      transformResponse: (response) => {
        return response?.data?.attributes;
      },
    }),
  }),
});

export const {
  useAddMessageMutation,
  useGetChatsQuery,
  useGetChatQuery,
  useGetMessagesQuery,
  useCancelOrWithdrawOfferMutation,
  useGetMoreMessagesQuery,
  useDeleteMessageMutation,
  useChatActionMutation,
  useReportChatMutation,
  useSearchMessagesQuery,
  useLazySearchMessagesQuery,
  useGetChatContextQuery,
  useStartChatWithUserMutation,
} = inboxApi;
