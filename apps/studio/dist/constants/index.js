"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KB = exports.MB = exports.GB = exports.OPT_IN_TAGS = exports.DOCS_URL = exports.USAGE_APPROACHING_THRESHOLD = exports.POSTHOG_URL = exports.STRIPE_PUBLIC_KEY = exports.GOTRUE_ERRORS = exports.DATETIME_FORMAT = exports.DATE_FORMAT = exports.BASE_PATH = exports.PG_META_URL = exports.API_URL = exports.IS_PLATFORM = void 0;
// Ignore barrel file rule here since it's just exporting more constants
// eslint-disable-next-line barrel-files/avoid-re-export-all
__exportStar(require("./infrastructure"), exports);
exports.IS_PLATFORM = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true';
exports.API_URL = (() => {
    if (process.env.NODE_ENV === 'test')
        return 'http://localhost:3000/api';
    //  If running in platform, use API_URL from the env var
    if (exports.IS_PLATFORM)
        return process.env.NEXT_PUBLIC_API_URL;
    // If running in browser, let it add the host
    if (typeof window !== 'undefined')
        return '/api';
    // If running self-hosted Vercel preview, use VERCEL_URL
    if (!!process.env.VERCEL_URL)
        return `https://${process.env.VERCEL_URL}/api`;
    // If running on self-hosted, use NEXT_PUBLIC_SITE_URL
    if (!!process.env.NEXT_PUBLIC_SITE_URL)
        return `${process.env.NEXT_PUBLIC_SITE_URL}/api`;
    return '/api';
})();
exports.PG_META_URL = exports.IS_PLATFORM
    ? process.env.PLATFORM_PG_META_URL
    : process.env.STUDIO_PG_META_URL;
exports.BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
/**
 * @deprecated use DATETIME_FORMAT
 */
exports.DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
// should be used for all dayjs formattings shown to the user. Includes timezone info.
exports.DATETIME_FORMAT = 'DD MMM YYYY, HH:mm:ss (ZZ)';
exports.GOTRUE_ERRORS = {
    UNVERIFIED_GITHUB_USER: 'Error sending confirmation mail',
};
exports.STRIPE_PUBLIC_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || 'pk_test_XVwg5IZH3I9Gti98hZw6KRzd00v5858heG';
exports.POSTHOG_URL = process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging' ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'local'
    ? 'https://ph.supabase.green'
    : 'https://ph.supabase.com';
exports.USAGE_APPROACHING_THRESHOLD = 0.75;
exports.DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'https://supabase.com/docs';
exports.OPT_IN_TAGS = {
    AI_SQL: 'AI_SQL_GENERATOR_OPT_IN',
    AI_DATA: 'AI_DATA_GENERATOR_OPT_IN',
    AI_LOG: 'AI_LOG_GENERATOR_OPT_IN',
};
exports.GB = 1024 * 1024 * 1024;
exports.MB = 1024 * 1024;
exports.KB = 1024;
