import { baseApi } from "../api/baseApi";

const notificationSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotificationSettings: builder.query({
      query: () => "/notification-settings",
      transformResponse: (r) => r?.data?.attributes || {},
      keepUnusedDataFor: 0,
    }),
    updateNotificationSettings: builder.mutation({ query: (body) => ({ url: "/notification-settings", method: "PATCH", body }) }),
    pushSubscribe: builder.mutation({ query: (subscription) => ({ url: "/notification-settings/push/subscribe", method: "POST", body: subscription }) }),
    pushUnsubscribe: builder.mutation({ query: (endpoint) => ({ url: "/notification-settings/push/unsubscribe", method: "POST", body: { endpoint } }) }),
    pushTest: builder.mutation({ query: () => ({ url: "/notification-settings/push/test", method: "POST" }) }),
  }),
});

export const {
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  usePushSubscribeMutation,
  usePushUnsubscribeMutation,
  usePushTestMutation,
} = notificationSettingsApi;
