import { baseApi } from "../api/baseApi";

const attrs = (r) => r?.data?.attributes ?? r?.data;
const m = (url, method = "POST") => (body) => ({ url: typeof url === "function" ? url(body) : url, method, body });

const hourlyApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getHourlyContracts: b.query({ query: () => "/hourly", transformResponse: attrs, providesTags: ["Hourly"] }),
    getHourlyContract: b.query({ query: (id) => `/hourly/${id}`, transformResponse: attrs, providesTags: ["Hourly"] }),
    createHourlyContract: b.mutation({ query: m("/hourly"), transformResponse: attrs, invalidatesTags: ["Hourly"] }),
    hourlyAction: b.mutation({ query: ({ id, action }) => ({ url: `/hourly/${id}/${action}`, method: "POST" }), invalidatesTags: ["Hourly"] }),
    logHourlyTime: b.mutation({ query: ({ id, ...body }) => ({ url: `/hourly/${id}/time`, method: "POST", body }), invalidatesTags: ["Hourly"] }),
    deleteHourlyTime: b.mutation({ query: ({ id, entryId }) => ({ url: `/hourly/${id}/time/${entryId}`, method: "DELETE" }), invalidatesTags: ["Hourly"] }),
    hourlyInvoiceAction: b.mutation({ query: ({ id, invId, action, reason }) => ({ url: `/hourly/${id}/invoices/${invId}/${action}`, method: "POST", body: { reason } }), invalidatesTags: ["Hourly"] }),
    topUpBalance: b.mutation({ query: (amount) => ({ url: "/hourly/wallet/topup", method: "POST", body: { amount } }), transformResponse: attrs }),
  }),
});

export const {
  useGetHourlyContractsQuery,
  useGetHourlyContractQuery,
  useCreateHourlyContractMutation,
  useHourlyActionMutation,
  useLogHourlyTimeMutation,
  useDeleteHourlyTimeMutation,
  useHourlyInvoiceActionMutation,
  useTopUpBalanceMutation,
} = hourlyApi;
