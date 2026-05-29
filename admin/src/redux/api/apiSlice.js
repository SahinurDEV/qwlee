
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import url from '../../baseUrl';

export const apiSlice = createApi({
  reducerPath: 'api',
  // Base URL is sourced from VITE_API_BASE_URL via baseUrl.js. The `/v1`
  // suffix is the API version prefix exposed by the Qwlee backend.
  baseQuery: fetchBaseQuery({ baseUrl: `${url}/v1` }),
   tagTypes: [
    "categories",
    "blog",
    "Image",
    "info/privacy",
    "info/terms",
    "info/trust-safety",
    "withdrawal/single?withdrawalId",
    "withdrawal",
    "users",
    "orders",
    "gigs",
    "supportTickets",
    "supportTicket",
    "verifications",
    "searches",
    "settings",
    "disputes",
   ],
  endpoints: (builder) => ({

 ///////////Authentication page//////////// 

forgotPassword: builder.mutation({
  query: (email) => ({
    url: "/auth/forgot-password",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: ` Bearer ${localStorage.getItem('token')}`
    },
    body: email
  })
}),

emailVerify: builder.mutation({
  query: ({otp, email}) => ({
    url: "/auth/verify-email",
    method: "POST",
    headers: {
         "Content-Type": "application/json",
      authorization: ` Bearer ${localStorage.getItem('token')}`
    },
    body: {
      oneTimeCode: otp,
      email: email,
    }
  })
}),

resetPassword: builder.mutation({
  query: ({email, password}) => ({
    url: "/auth/reset-password",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
   authorization: ` Bearer ${localStorage.getItem('token')}`
 },
 body: { 
  email,
  password,
}
  })
}), 
changPassword: builder.mutation({
  query: (values) => ({
    url: '/auth/change-password',
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: values, // Send the values directly, without wrapping in another object
  }),
}),


 ///////////Total Status////////////
 totalStatus:builder.query({
  query: () => ({
   url: "/admin/getTotalStatus",
   method: "GET",
   headers : {
    "Content-Type": "application/json",
    authorization: ` Bearer ${localStorage.getItem('token')}`
   }
  }) 
 }),
 /////////Income ratio , ////////////
 getIncomeRatio: builder.query({
  query: (year) => ({
    url: `/admin/getIncomeRatio?year=${year}`,
    method: "GET",
    headers : {
      "Content-Type": "application/json",
      authorization: ` Bearer ${localStorage.getItem('token')}`
     }
  }) 
}),

////******|Earnings************ */
getEarning: builder.query({
  query: ({year, page}) => ({
    url: `/admin/earnings?year=${year}&page=${page}`,
    method:"GET",
    headers:{
      authorization: ` Bearer ${localStorage.getItem('token')}`
    }
  })
}),

///********UserRatio********* */
getUserRatio:builder.query({
  query: (month) => ({
    url: `/admin/getUserRatio?month=${month}`,
    method: "GET",
    headers:{
      authorization: ` Bearer ${localStorage.getItem('token')}`
    }
  })
}),

///*******Recent Users************ */
getRecentUser:builder.query({
  query: () => ({
    url: '/admin/recentUsers',
    method: "GET",
    headers: {

      authorization: ` Bearer ${localStorage.getItem('token')}`
    }
    
 
  })
}),


    // Category api intigration >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>//////////

    getCategories: builder.query({
      // Match the marketplace navbar so the admin sees every seeded
      // category in one view (no useless pagination when the list is
      // tiny). transformResponse strips the envelope so consumers can
      // read .results / .totalResults directly.
      query: (page = 1) => `/categories?page=${page}&limit=50`,
      providesTags: ["categories"],
      transformResponse: (res) =>
        res?.data?.attributes || res?.results || res || {},
    }),

    addCategory: builder.mutation({
         query: (formData) => ({
            url:'/categories',
            method:"POST",
            body: formData,
            headers: {
                authorization: ` Bearer ${localStorage.getItem('token')}`
            }
         }),
         invalidatesTags: ["categories"]

}), 

    updateCategory: builder.mutation({
      query: ( {id, formData} ) => ({ 
        url: `/categories?categoryId=${id}`,
        method: 'PATCH',
        headers: {
            authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body:  formData, 
      }),
      invalidatesTags:["categories"]
    }), 

    deleteCategories: builder.mutation({
      query: (id) => ({ 
        url: `/categories/${id}`,
        headers: {
            authorization: `Bearer ${localStorage.getItem('token')}`
        },
        method: 'DELETE',
      }),
      invalidatesTags:["categories"]
    }),



    //   Blogs data Intigration >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>/////
    getBlogs: builder.query({
        query: (page) => `/blog?page=${page}&limit=6`, 
        providesTags: ["blog"]
      }), 
    addBlogs: builder.mutation({
      query: (newBlogs) => ({
        url:'/blog',
        method:"POST",
        headers: {
          authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: newBlogs,
      }),
      invalidatesTags:["blog"]
    }),

    deleteBlog: builder.mutation({
      query: (id) => ({
        url:`/blog/${id}`,
        headers: {
          authorization: `Bearer ${localStorage.getItem('token')}`
        },
        method: 'DELETE',
      }),
      invalidatesTags:['blog']
    }),
    updateBlog: builder.mutation({
      query: ({_id, formData}) => ({
        url: `/blog/${_id}`,
        method: 'PATCH',
        headers: {
          authorization:`Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      }),
      invalidatesTags:['blog']
    }),



      // Privacy data gettt >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>/////
      getPrivacy: builder.query({
        query: () => '/info/privacy',
            providesTags: ['info/privacy'], 
      }),

    addPrivacy: builder.mutation({
      query: (privacy) => ({
        url: '/info/privacy',
        method:'POST',
        headers: {
          authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: privacy,
      }),
      invalidatesTags: ["info/privacy"],
    }),



  //  Term & conditon data get >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>///////

  getTermConditon: builder.query({
    query: () => '/info/terms', 
    providesTags: ["info/terms"]
  }), 

  addTermCondition: builder.mutation({
    query: (privacy) => ({
      url: '/info/terms',
      method:'POST',
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: privacy,
    }),
    invalidatesTags: ["info/terms"],
  }),

// ********************trus&safty Api get >>>>>>>>>>>>>>>>>>>>>>>>>>>>******************/// 
getTrustSafety: builder.query({
  query: () => "/info/trust-safety",
  providesTags: ['info/trust-safety']
}),
addTrustSafety: builder.mutation({
  query: (trustSafery) => ({
    url: '/info/trust-safety',
    method:"POST",
    headers: {
      authorization:`Bearer ${localStorage.getItem('token')}`
    },
    body: trustSafery,
  }),
  invalidatesTags: ["info/trust-safety"]
}),

// BuyerList Api get****************************/////////
getBuyerList: builder.query({
 query: (params = {}) => {
   const qs = new URLSearchParams({ role: "buyer", limit: 100, ...params }).toString();
   return { url: `/users?${qs}`, headers: { authorization: `Bearer ${localStorage.getItem("token")}` } };
 },
 providesTags: ["users"],
}),

////**********FrelancerList Api get *************/////
getFrelancerList: builder.query({
  query: (params = {}) => {
    const qs = new URLSearchParams({ role: "freelancer", limit: 100, ...params }).toString();
    return { url: `/users?${qs}`, headers: { authorization: `Bearer ${localStorage.getItem("token")}` } };
  },
  providesTags: ["users"],
}),

// Admin orders + gigs list. Backend exposes full-platform views under
// /admin/* so they're not scoped to the admin's own user the way the
// regular /orders + /gig endpoints are.
getAdminOrders: builder.query({
  query: (params = {}) => {
    const qs = new URLSearchParams({ limit: 100, ...params }).toString();
    return { url: `/admin/orders?${qs}`, headers: { authorization: `Bearer ${localStorage.getItem("token")}` } };
  },
  providesTags: ["orders"],
}),
getAdminGigs: builder.query({
  query: (params = {}) => {
    const qs = new URLSearchParams({ limit: 100, ...params }).toString();
    return { url: `/admin/gigs?${qs}`, headers: { authorization: `Bearer ${localStorage.getItem("token")}` } };
  },
  providesTags: ["gigs"],
}),

// Single-user activity feed (login history + routes + timeline). Used
// by the admin user-monitor page.
getUserActivity: builder.query({
  query: ({ userId, limit = 100 } = {}) => ({
    url: `/admin/user-activity/${userId}?limit=${limit}`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes || res,
}),

// Admin conversation moderation — read-only access to direct messages
// and order chats across the platform.
getDirectChats: builder.query({
  query: ({ search = "" } = {}) => ({
    url: `/admin/chats?search=${encodeURIComponent(search)}&limit=200`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
}),
getDirectChatMessages: builder.query({
  query: (chatId) => ({
    url: `/admin/chats/${chatId}/messages`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
}),
getOrderChats: builder.query({
  query: ({ search = "" } = {}) => ({
    url: `/admin/order-chats?search=${encodeURIComponent(search)}&limit=200`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
}),
getOrderChatMessages: builder.query({
  query: (orderId) => ({
    url: `/admin/order-chats/${orderId}/messages`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
}),

// Seller verification — admin review.
getVerifications: builder.query({
  query: ({ status = "pending" } = {}) => ({
    url: `/verification?status=${status}&limit=200`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
  providesTags: ["verifications"],
}),
reviewVerification: builder.mutation({
  query: ({ userId, action, reason }) => ({
    url: `/verification/${userId}`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { action, reason },
  }),
  invalidatesTags: ["verifications", "users"],
}),

// Support tickets — admin view.
getSupportTickets: builder.query({
  query: ({ status } = {}) => {
    const qs = new URLSearchParams();
    if (status) qs.append("status", status);
    qs.append("limit", 200);
    return {
      url: `/support/tickets?${qs.toString()}`,
      headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
    };
  },
  transformResponse: (res) => res?.data?.attributes,
  providesTags: ["supportTickets"],
}),
getSupportTicket: builder.query({
  query: (ticketId) => ({
    url: `/support/tickets/${ticketId}`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
  providesTags: (_r, _e, id) => [{ type: "supportTicket", id }],
}),
postSupportMessage: builder.mutation({
  query: ({ ticketId, body }) => ({
    url: `/support/tickets/${ticketId}/messages`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { body },
  }),
  invalidatesTags: (_r, _e, arg) => [
    { type: "supportTicket", id: arg.ticketId },
    "supportTickets",
  ],
}),
updateSupportStatus: builder.mutation({
  query: ({ ticketId, status }) => ({
    url: `/support/tickets/${ticketId}`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { status },
  }),
  invalidatesTags: (_r, _e, arg) => [
    { type: "supportTicket", id: arg.ticketId },
    "supportTickets",
  ],
}),

// Seller level controls — list, override per-seller, edit tier thresholds.
getSellerLevels: builder.query({
  query: ({ search = "" } = {}) => ({
    url: `/admin/seller-levels?search=${encodeURIComponent(search)}`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes?.sellers || [],
  providesTags: ["users"],
}),
getLevelTiers: builder.query({
  query: () => ({
    url: `/admin/seller-levels/tiers`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes?.tiers || [],
  providesTags: ["settings"],
}),
updateLevelTiers: builder.mutation({
  query: (tiers) => ({
    url: `/admin/seller-levels/tiers`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { tiers },
  }),
  invalidatesTags: ["settings", "users"],
}),
setLevelOverride: builder.mutation({
  query: ({ userId, tierId, reason }) => ({
    url: `/admin/seller-levels/${userId}/override`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { tierId, reason },
  }),
  invalidatesTags: ["users"],
}),

// Admin delete a gig — soft by default (sets isDeleted=true), or
// `hard: true` to permanently delete (only allowed when the gig has
// zero orders and reviews).
deleteAdminGig: builder.mutation({
  query: ({ gigId, hard = false, reason }) => ({
    url: `/admin/gigs/${gigId}${hard ? "?hard=true" : ""}`,
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: hard ? undefined : { reason },
  }),
  invalidatesTags: ["gigs"],
}),
restoreAdminGig: builder.mutation({
  query: (gigId) => ({
    url: `/admin/gigs/${gigId}/restore`,
    method: "PATCH",
    headers: {
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  }),
  invalidatesTags: ["gigs"],
}),

// Gig moderation — flip a gig's status (active / pending /
// requires-modification / denied / paused / draft). Reason is shown
// to the seller on their next dashboard load.
updateGigStatus: builder.mutation({
  query: ({ gigId, status, reason }) => ({
    url: `/admin/gigs/${gigId}/status`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { status, reason },
  }),
  invalidatesTags: ["gigs"],
}),

// Admin opens a support ticket on behalf of users — orderId resolves
// buyer + seller as participants, or pass participantIds explicitly.
adminCreateTicket: builder.mutation({
  query: (body) => ({
    url: `/admin/support/tickets`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body,
  }),
  invalidatesTags: ["supportTickets"],
}),

// Admin force-cancel order — Fiverr-style support override. Works on any
// order regardless of status. Optional `reason` is shown in the
// cancellation email to both parties and stored on the order for audit.
adminCancelOrder: builder.mutation({
  query: ({ orderId, reason }) => ({
    url: `/admin/orders/${orderId}/cancel`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { reason },
  }),
  invalidatesTags: ["orders"],
}),

// Ban / unban — both invalidate the users list so the row reflects
// the new state immediately.
banUser: builder.mutation({
  query: ({ userId, reason }) => ({
    url: `/admin/users/${userId}/ban`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { reason },
  }),
  invalidatesTags: ["users"],
}),
unbanUser: builder.mutation({
  query: (userId) => ({
    url: `/admin/users/${userId}/unban`,
    method: "PATCH",
    headers: {
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  }),
  invalidatesTags: ["users"],
}),

// Platform settings (payments / SMTP / misc / custom providers).
getSettings: builder.query({
  query: () => ({
    url: `/admin/settings`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
  providesTags: ["settings"],
}),
updateSettings: builder.mutation({
  query: (patch) => ({
    url: `/admin/settings`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: patch,
  }),
  invalidatesTags: ["settings"],
}),
addCustomPayment: builder.mutation({
  query: (payload) => ({
    url: `/admin/settings/custom-payments`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: payload,
  }),
  invalidatesTags: ["settings"],
}),
removeCustomPayment: builder.mutation({
  query: (id) => ({
    url: `/admin/settings/custom-payments/${id}`,
    method: "DELETE",
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  invalidatesTags: ["settings"],
}),
sendTestEmail: builder.mutation({
  query: ({ to, template = "verification" }) => ({
    url: `/admin/settings/test-email`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: { to, template },
  }),
}),

// Search-log monitoring — paginated table + headline stats.
getAdminSearches: builder.query({
  query: (params = {}) => {
    const qs = new URLSearchParams({ limit: 50, page: 1, ...params }).toString();
    return {
      url: `/admin/searches?${qs}`,
      headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
    };
  },
  transformResponse: (res) => res?.data?.attributes,
  providesTags: ["searches"],
}),
getSearchStats: builder.query({
  query: () => ({
    url: `/admin/search-stats`,
    headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
  }),
  transformResponse: (res) => res?.data?.attributes,
  providesTags: ["searches"],
}),

 ///***********Notification api get */

 getNotification: builder.query({
  query: ( ) => ({
    url: '/notification/admin',
    method:'GET',
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`
    },
    // body: privacy,
  }), 
}),

////***************Withdraw api get */
 getWithdrawUser: builder.query({
  providesTags: ['withdrawal'],
  query: ( ) => ({
    url: '/withdrawal',
    method:'GET',
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`
    },
    // body: privacy,
  }), 
  invalidatesTags:['withdrawal']
}),

 getSingleWithdrawUser: builder.query({
  query: (id) => ({
    url: `/withdrawal/single?withdrawalId=${id}`,
    method:'GET',
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`
    },
    // body: privacy,
  }), 
  invalidatesTags:['withdrawal/single?withdrawalId']
}),

withdrawCancelById: builder.mutation({
  query: (id) => ({
    url:`/withdrawal/${id}`,
    method:'PATCH',
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`
    },
    // body:
  }),
  invalidatesTags:['withdrawal']
}),

withdrawPostById: builder.mutation({
  query: (id) => 
    {
    
      return {
    url:`/withdrawal/${id}`,
    method:'POST',
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`
    },
    // body:
      }
  },
invalidatesTags: ["withdrawal"] 
}),

// *****************Profile***************/////

updateProfileInfo: builder.mutation({
  query: (profileInfo) => ({
    url: '/users/profile',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: profileInfo,
  }),
}),
// Update profile picture
updateProfielPicture: builder.mutation({
  query: (formData) => ({
    url: '/users/profile-image',
    method: 'POST',
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`,
    
    },
    body: formData,
  }),
}),

// **************slider Image******************/////
 
    getIamage: builder.query({
      providesTags: ['Image'],
      query: () => ({
        url: `/banner-image`,
        method: "GET",
        headers: {
          authorization: `Bearer ${localStorage.getItem('token')}`,
          
        },
      })
    }),

    addSliderImage: builder.mutation({
      query: (data) => ({
        url: `/banner-image`,
        method: "POST",
        body: data,
        headers: {
          authorization: `Bearer ${localStorage.getItem('token')}`,
        }
      }),
      invalidatesTags: ['Image'],
    }),

    deleteImage: builder.mutation({
      query: (id) => ({
        url: `/banner-image/${id}`,
        method: "DELETE",
        headers: {
          authorization: `Bearer ${localStorage.getItem('token')}`,
        }
      }),
      invalidatesTags: ['Image'],
    }),

    // Disputes — admin queue and resolution.
    getAdminDisputes: builder.query({
      query: ({ status, page = 1, limit = 50 } = {}) => {
        const qs = new URLSearchParams({ limit, page });
        if (status) qs.append("status", status);
        return {
          url: `/disputes?${qs.toString()}`,
          headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
        };
      },
      transformResponse: (res) => res?.data?.attributes,
      providesTags: ["disputes"],
    }),
    getDisputeDetail: builder.query({
      query: (disputeId) => ({
        url: `/disputes/${disputeId}`,
        headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
      }),
      transformResponse: (res) => res?.data?.attributes,
      providesTags: ["disputes"],
    }),
    resolveDispute: builder.mutation({
      query: ({ disputeId, resolution, resolutionNote }) => ({
        url: `/disputes/${disputeId}/resolve`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: { resolution, resolutionNote },
      }),
      invalidatesTags: ["disputes", "orders"],
    }),

  }),
});

 export const {
     useUpdateProfielPictureMutation,
     useUpdateProfileInfoMutation,
      useForgotPasswordMutation,
      useEmailVerifyMutation,
      useResetPasswordMutation,
      useChangPasswordMutation,
      useGetCategoriesQuery,
      useAddCategoryMutation,
      useUpdateCategoryMutation,
      useDeleteCategoriesMutation,
      useGetBlogsQuery,
      useAddBlogsMutation,
      useDeleteBlogMutation,
      useUpdateBlogMutation,
      useGetPrivacyQuery,
      useAddPrivacyMutation,
      useGetTermConditonQuery,
      useAddTermConditionMutation,
      useGetTrustSafetyQuery,
      useAddTrustSafetyMutation,
      useGetBuyerListQuery,
      useGetFrelancerListQuery,
      useGetNotificationQuery,
      useGetWithdrawUserQuery,
      useGetSingleWithdrawUserQuery,
      useWithdrawCancelByIdMutation,
      useWithdrawPostByIdMutation,
      useTotalStatusQuery,
      useGetIncomeRatioQuery,
      useGetEarningQuery,
      useGetUserRatioQuery,
      useGetRecentUserQuery,
      useGetIamageQuery,
      useAddSliderImageMutation,
      useDeleteImageMutation,
      useGetAdminOrdersQuery,
      useGetAdminGigsQuery,
      useGetUserActivityQuery,
      useBanUserMutation,
      useUnbanUserMutation,
      useGetSupportTicketsQuery,
      useGetSupportTicketQuery,
      usePostSupportMessageMutation,
      useUpdateSupportStatusMutation,
      useGetVerificationsQuery,
      useReviewVerificationMutation,
      useGetDirectChatsQuery,
      useGetDirectChatMessagesQuery,
      useGetOrderChatsQuery,
      useGetOrderChatMessagesQuery,
      useGetAdminSearchesQuery,
      useGetSearchStatsQuery,
      useGetSettingsQuery,
      useUpdateSettingsMutation,
      useAddCustomPaymentMutation,
      useRemoveCustomPaymentMutation,
      useSendTestEmailMutation,
      useAdminCancelOrderMutation,
      useAdminCreateTicketMutation,
      useUpdateGigStatusMutation,
      useGetSellerLevelsQuery,
      useGetLevelTiersQuery,
      useUpdateLevelTiersMutation,
      useSetLevelOverrideMutation,
      useDeleteAdminGigMutation,
      useRestoreAdminGigMutation,
      useGetAdminDisputesQuery,
      useGetDisputeDetailQuery,
      useResolveDisputeMutation,

 } = apiSlice;