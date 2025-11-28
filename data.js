const enums = {
  eUserRoles: {
    value: ['teacher', 'parent', 'student', 'sponser'],
    // value: ['schooladmin', 'teacher', 'parent', 'student'],
    map: {
      // SCHOOLADMIN: 'schooladmin',
      TEACHER: 'teacher',
      PARENT: 'parent',
      STUDENT: 'student',
      SPONSOR: 'sponser'
    }
  },
  eDeviceType: {
    value: ['M', 'T', 'W'],
    default: 'W',
    description: {
      M: 'Mobile',
      T: 'Tablet',
      W: 'Web'
    },
    map: {
      MOBILE: 'M',
      TABLET: 'T',
      WEB: 'W'
    }
  },
  eSubscriptionPlan: {
    value: ['freemium', 'premium', 'expired'],
    map: {
      FREEMIUM: 'freemium',
      PREMIUM: 'premium',
      EXPIRED: 'expired'
    }
  },
  ePaymentMethod: {
    value: ['upi', 'netbanking', 'card'],
    map: {
      UPI: 'upi',
      NETBANKING: 'netbanking',
      CARD: 'card'
    }
  },
  ePaymentStatus: {
    value: ['P', 'S', 'F', 'R'],
    default: 'P',
    description: {
      P: 'Pending',
      S: 'Success',
      F: 'Failed',
      R: 'Refund'
    },
    map: {
      PENDING: 'P',
      SUCCESS: 'S',
      FAILED: 'F',
      REFUND: 'R'
    }
  },
  ePaymentGateway: {
    value: ['ADMIN', 'STRIPE'],
    default: 'ADMIN',
    description: {
      STRIPE: 'Strip',
      ADMIN: 'Admin'
    },
    map: {
      STRIPE: 'STRIPE',
      ADMIN: 'ADMIN'
    }
  },
  eStudentInviteStatus: {
    value: ['pending', 'sent', 'accepted', 'expired', 'failed'],
    map: {
      PENDING: 'pending',
      SENT: 'sent',
      ACCEPTED: 'accepted',
      EXPIRED: 'expired',
      FAILED: 'failed'
    }
  },
  eAdminLogType: {
    value: ['L', 'PC', 'RP'],
    description: { L: 'Login', PC: 'Password Change', RP: 'Reset Password' },
    map: {
      LOGIN: 'L',
      PASSWORD_CHANGE: 'PC',
      RESET_PASSWORD: 'RP'
    }
  },
  eAdminStatus: {
    value: ['Y', 'B', 'D'],
    description: { Y: 'Active', B: 'Blocked', D: 'Deleted' },
    map: {
      ACTIVE: 'Y',
      BLOCKED: 'B',
      DELETED: 'D'
    }
  },
  eAdminType: {
    value: ['SUPER', 'SUB'],
    description: { SUPER: 'Super Admin', SUB: 'Sub Admin' },
    map: {
      SUPER: 'SUPER',
      SUB: 'SUB'
    }
  },
  eStatus: {
    value: ['active', 'inactive'],
    description: { active: 'Active', inactive: 'Inactive' },
    map: {
      ACTIVE: 'active',
      INACTIVE: 'inactive'
    }
  },

  eVideoStatus: {
    value: ['inprogress', 'active', 'inactive'],
    description: { inprogress: 'In Progress', active: 'Active', inactive: 'Inactive' },
    map: {
      ACTIVE: 'active',
      INACTIVE: 'inactive',
      INPROGRESS: 'inprogress'
    }
  },

  eBannerKey: {
    value: ['home', 'explore', 'grade'],
    description: { home: 'Home', explore: 'Explore', grade: 'Grade' },
    map: {
      HOME: 'home',
      EXPLORE: 'explore',
      GRADE: 'grade'
    }
  },
  eAdminLogKeys: {
    value: [
      'P',
      'SUB',
      'PC',
      'S',
      'IP',
      'FEEDBACK',
      'COLUMN_PREFERENCE',
      'PERMISSION',
      'ROLE',
      'V',
      'NOTIFICATION'
    ],
    description: {
      P: 'PROFILE',
      SUB: 'SUBADMIN',
      PC: 'PASSWORD CHANGE',
      S: 'SETTINGS',
      IP: 'NETWORK ACCESS',
      FEEDBACK: 'FEEDBACK',
      COLUMN_PREFERENCE: 'COLUMN_PREFERENCE',
      PERMISSION: 'PERMISSION',
      ROLE: 'ROLE',
      V: 'VERSION',
      NOTIFICATION: 'NOTIFICATION'
    },
    map: {
      PROFILE: 'P',
      SUBADMIN: 'SUB',
      PASSWORD_CHANGE: 'PC',
      SETTINGS: 'S',
      NETWORK_ACCESS: 'IP',
      FEEDBACK: 'FEEDBACK',
      COLUMN_PREFERENCE: 'COLUMN_PREFERENCE',
      PERMISSION: 'PERMISSION',
      ROLE: 'ROLE',
      VERSION: 'V',
      NOTIFICATION: 'NOTIFICATION'
    }
  },
  eAdminPermission: {
    value: ['R', 'W', 'N'],
    description: { R: 'Read', W: 'Write', N: 'None' },
    map: {
      READ: 'R',
      WRITE: 'W',
      NONE: 'N'
    }
  },
  adminPermission: [
    // Various admin permission modules
    'LINGO',
    'REPORT',
    'CATEGORY',
    'TEST',
    'USERS_PERSONAL_INFO',
    'SUBADMIN',
    'PERMISSION',
    'ADMIN',
    'BANNER',
    'CMS',
    'EMAIL_TEMPLATES',
    'LEAGUE',
    'MAINTENANCE',
    'MATCH',
    'NOTIFICATION',
    'PUSHNOTIFICATION',
    'PROMO',
    'SETTING',
    'USERS',
    'DASHBOARD',
    'FEEDBACK',
    // Course Management Permissions
    'GRADES',
    'SUBJECTS',
    'TERMS',
    'VIDEOS',
    'RESOURCES',
    'QUIZ',
    // Subscription Management Permissions
    'SUBSCRIPTION',
    'BULK_STUDENTS',
    'STUDENT_INVITATIONS'
  ],

  moduleName: [
    // Permission modules in the application
    'EMAIL-TEMPLATE',
    'FEEDBACKS',
    'NOTIFICATIONS',
    'OFFERS',
    'PAYMENT-GATEWAYS',
    'PAYOUT-GATEWAYS',
    'POPUP-ADS-MANAGEMENT',
    'PROMO-CODES',
    'SETTINGS',
    'SLIDERS',
    'VERSIONS',
    'USER',
    'DROPPED-USERS',
    'DELETED-USERS',
    'SYSTEM-USERS',
    'TRANSACTIONS',
    'PUSH-NOTIFICATIONS',
    'FILTER-CATEGORIES',
    'SUB-ADMIN-ROLES',
    'SUB-ADMINS',
    'ADMIN-LOGS',
    // Subscription UI modules
    'SUBSCRIPTIONS',
    'BULK-STUDENTS',
    'STUDENT-INVITATIONS',
    'QUIZ'
  ],
  imageFormat: [
    // Supported image formats
    { extension: 'jpeg', type: 'image/jpeg' },
    { extension: 'jpg', type: 'image/jpeg' },
    { extension: 'png', type: 'image/png' },
    { extension: 'gif', type: 'image/gif' },
    { extension: 'svg', type: 'image/svg+xml' },
    { extension: 'heic', type: 'image/heic' },
    { extension: 'heif', type: 'image/heif' }
  ],
  eDocumentContentType: {
    value: ['image/jpeg', 'image/png', 'application/pdf'],
    description: {
      'image/jpeg': 'JPEG',
      'image/png': 'PNG',
      'image/gif': 'GIF',
      'image/svg+xml': 'SVG',
      'image/heic': 'HEIC',
      'image/heif': 'HEIF'
    },
    map: {
      JPEG: 'image/jpeg',
      PNG: 'image/png',
      PDF: 'application/pdf'
    }
  },
  //   eDocumentType: {
  //     value: ['i', 'p'],
  //     description: { i: 'Image', p: 'PDF' },
  //     map: {
  //       IMAGE: 'i',
  //       PDF: 'p'
  //     },
  //     default: 'i'
  //   },
  eDocumentType: {
    value: ['pdf', 'presentation', 'assignement', 'notes', 'other'],
    map: {
      PDF: 'PDF',
      PRESENTATION: 'P',
      ASSIGNMENT: 'A',
      NOTES: 'N',
      OTHER: 'O'
    },
    default: 'pdf'
  },
  eOtpType: {
    value: ['E', 'M'],
    description: { E: 'Email', M: 'Mobile' },
    map: {
      EMAIL: 'E',
      MOBILE: 'M'
    },
    default: 'E'
  },
  eOtpAuth: {
    value: ['L', 'F', 'V', 'R'],
    description: { L: 'Login', F: 'ForgotPass', V: 'Verification', R: 'Register' },
    map: {
      LOGIN: 'L',
      FORGOT_PASS: 'F',
      VERIFICATION: 'V',
      REGISTER: 'R'
    },
    default: 'R'
  },
  permissionModule: [
    'USER',
    'ADMIN',
    'SUB-ADMIN',
    'OTHER'
  ], // Permission modules for admin panel
  eEnv: {
    value: ['dev', 'prod', 'stag'],
    description: { dev: 'Development', prod: 'Production', stag: 'Staging' },
    map: {
      DEVELOPMENT: 'dev',
      PRODUCTION: 'pod',
      STAGING: 'stag'
    },
    default: 'dev'
  },
  eSenderType: {
    value: ['A', 'U'],
    description: { A: 'AI', U: 'User' },
    map: {
      AI: 'A',
      USER: 'U'
    },
    default: 'U'
  },

  eActiveStatus: {
    value: ['Y', 'N'],
    default: 'Y',
    description: { Y: 'Active', N: 'Inactive' },
    map: {
      ACTIVE: 'Y',
      INACTIVE: 'N'
    }
  },
  eAITutorStatus: {
    value: ['I', 'A', 'C'],
    default: 'I',
    description: { I: 'Initiated', A: 'Active', C: 'Closed' },
    map: {
      INITIATED: 'I',
      ACTIVE: 'A',
      CLOSED: 'C'
    }
  },

  eBillingType: {
    value: ['R', 'O'],
    default: 'R',
    description: { Recursive: 'R', Once: 'O' },
    map: {
      RECURSIVE: 'R',
      ONCE: 'O'
    }
  },
  eBillingCycle: {
    value: ['Y', 'M', 'D'],
    default: 'M',
    description: { Yearly: 'Y', Monthly: 'M', Day: 'D' },
    map: {
      MONTHLY: 'M',
      YEARLY: 'Y',
      DAY: 'D'
    }
  },
  eSubscriptionType: {
    value: ['F', 'P'],
    default: 'P',
    description: { Freemium: 'F', Premium: 'P' },
    map: {
      FREEMIUM: 'F',
      PREMIUM: 'P'
    }
  },

  eStripeInterval: {
    value: ['day', 'month', 'week', 'year'],
    default: 'month',
    description: { Day: 'day', Monthly: 'month', Week: 'week', Year: 'year' },
    map: {
      DAY: 'day',
      MONTHLY: 'month',
      YEARLY: 'year',
      WEEK: 'week'
    }
  },

  eSeoType: {
    value: ['home', 'grade', 'subject', 'term', 'video'],
    map: {
      HOME: 'home',
      GRADE: 'grade',
      SUBJECT: 'subject',
      TERM: 'term',
      VIDEO: 'video'
    }
  },
  eHttpStatusCode: {
    value: [301, 302, 307, 308],
    default: 301,
    map: {
      301: 301,
      302: 302,
      307: 307,
      308: 308
    }
  },
  eActivityType: {
    value: [
      'video_watch',
      'video_complete',
      'term_complete',
      'subject_complete',
      'grade_complete',
      'streak_achieved',
      'badge_earned',
      'first_video',
      // 'resource_accessed',
      'quiz_completed',
      // 'assignment_submitted',
      'other'
    ],
    description: {
      video_watch: 'Watched a video',
      video_complete: 'Completed a video (>90%)',
      term_complete: 'Completed all videos in a term',
      subject_complete: 'Completed all videos in a subject',
      grade_complete: 'Completed all videos in a grade',
      streak_achieved: 'Achieved a streak milestone',
      badge_earned: 'Earned a badge',
      first_video: 'First video watched',
      // resource_accessed: 'Accessed a learning resource',
      quiz_completed: 'Completed a quiz',
      // assignment_submitted: 'Submitted an assignment',
      other: 'Other custom activity'
    },
    map: {
      VIDEO_WATCH: 'video_watch',
      VIDEO_COMPLETE: 'video_complete',
      TERM_COMPLETE: 'term_complete',
      SUBJECT_COMPLETE: 'subject_complete',
      GRADE_COMPLETE: 'grade_complete',
      STREAK_ACHIEVED: 'streak_achieved',
      BADGE_EARNED: 'badge_earned',
      FIRST_VIDEO: 'first_video',
      // RESOURCE_ACCESSED: 'resource_accessed',
      QUIZ_COMPLETED: 'quiz_completed',
      // ASSIGNMENT_SUBMITTED: 'assignment_submitted',
      OTHER: 'other'
    }
  },

  eBadgeTier: {
    value: ['bronze', 'silver', 'gold', 'platinum', 'custom'],
    map: {
      BRONZE: 'bronze',
      SILVER: 'silver',
      GOLD: 'gold',
      PLATINUM: 'platinum',
      CUSTOM: 'custom'
    },
    default: 'bronze'
  },
  eBadgeType: {
    value: ['quiz_performance', 'term_explorer', 'streak_master', 'perfectionist', 'master_scholar'],
    map: {
      QUIZ_PERFORMANCE: 'quiz_performance',
      TERM_EXPLORER: 'term_explorer',
      STREAK_MASTER: 'streak_master',
      PERFECTIONIST: 'perfectionist',
      MASTER_SCHOLAR: 'master_scholar'
    },
    default: 'quiz_performance'
  }
};

module.exports = enums;
