"use client";
import { baseUrl } from "@/lib/constant";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import Cookies from "js-cookie";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: `${baseUrl}`,
    credentials: "include",
    prepareHeaders: (headers) => {
      // Prefer Authorization when a legacy/non-HttpOnly cookie still exists
      // (local scripts). HttpOnly tokens ride as cookies via credentials.
      const token = Cookies.get("accessToken");
      if (token) {
        try {
          headers.set("Authorization", `Bearer ${JSON.parse(token)}`);
        } catch {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }
      headers.set("X-Custom-Header", "foobar");
      return headers;
    },
  }),
  tagTypes: [
    "Contests",
    "Hourly",
    "SellerPlan",
    "Credits",
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
