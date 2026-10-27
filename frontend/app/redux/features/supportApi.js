// RTK Query slice for the support tickets feature.

import { baseApi } from "../api/baseApi";

const supportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyTickets: builder.query({
      query: ({ status, limit = 50, page = 1 } = {}) => {
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        if (limit) params.append("limit", limit);
        if (page) params.append("page", page);
        return { url: `/support/tickets?${params.toString()}` };
      },
      transformResponse: (res) => res?.data?.attributes,
      providesTags: ["SupportTickets"],
    }),
    getTicket: builder.query({
      query: (ticketId) => `/support/tickets/${ticketId}`,
      transformResponse: (res) => res?.data?.attributes,
      providesTags: (result, _e, id) => [{ type: "SupportTicket", id }],
    }),
    createTicket: builder.mutation({
      query: (payload) => ({
        url: "/support/tickets",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["SupportTickets"],
    }),
    postTicketMessage: builder.mutation({
      query: ({ ticketId, body }) => ({
        url: `/support/tickets/${ticketId}/messages`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "SupportTicket", id: arg.ticketId },
        "SupportTickets",
      ],
    }),
    askSupportAi: builder.mutation({
      query: (body) => ({ url: "/support/ai/ask", method: "POST", body }),
      transformResponse: (res) => res?.data?.attributes,
      invalidatesTags: ["SupportTickets"],
    }),
    getSupportAiStatus: builder.query({
      query: () => "/support/ai/status",
      transformResponse: (res) => res?.data?.attributes,
    }),
  }),
});

export const {
  useGetMyTicketsQuery,
  useGetTicketQuery,
  useCreateTicketMutation,
  useAskSupportAiMutation,
  useGetSupportAiStatusQuery,
  usePostTicketMessageMutation,
} = supportApi;
