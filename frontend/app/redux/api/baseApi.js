"use client";
import { baseUrl } from "@/lib/constant";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import Cookies from "js-cookie";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: `${baseUrl}`,
    prepareHeaders: (headers) => {
      const token = Cookies.get("accessToken");
      if (token) {
        headers.set("Authorization", `Bearer ${JSON.parse(token)}`);
      }
      headers.set("X-Custom-Header", "foobar");
      return headers;
    },
  }),
  tagTypes: [
    "Subscriptions",
    "Promotions",
    "SingeUser",
    "Portfolio",
    "Users",
    "updateGig",
    "Gigs",
    "ReactLove",
    "GigReviews",
    "QuickReplies",
    "Chat",
    "Messages",
    "Withdraw",
    "Orders",
    "OrderMessages",
    "Notifications",
    "SupportTickets",
    "SupportTicket",
    "Disputes",
    "Requests",
  ],
  endpoints: (builder) => ({
    // Example endpoint
    getExampleData: builder.query({
      query: () => "example-endpoint",
    }),
  }),
});

export const { useGetExampleDataQuery } = baseApi;
