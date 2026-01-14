"use strict";
/**
 * Studio application constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IS_TEST = exports.IS_PRODUCTION = exports.IS_DEVELOPMENT = exports.BASE_PATH = exports.API_URL = exports.FLY_REGIONS_DEFAULT = exports.AWS_REGIONS_DEFAULT = exports.PG_META_URL = exports.INSTANCE_MICRO_SPECS = exports.INSTANCE_NANO_SPECS = exports.DEFAULT_PROJECT_API_SERVICE_ID = exports.DEFAULT_MINIMUM_PASSWORD_STRENGTH = exports.PASSWORD_STRENGTH_PERCENTAGE = exports.PASSWORD_STRENGTH_COLOR = exports.PASSWORD_STRENGTH = exports.PRICING_TIER_PRODUCT_IDS = exports.PRICING_TIER_LABELS_ORG = exports.MANAGED_BY = exports.useDefaultProvider = exports.PROVIDERS = exports.KB = exports.MB = exports.GB = exports.OPT_IN_TAGS = exports.USAGE_APPROACHING_THRESHOLD = exports.POSTHOG_URL = exports.STRIPE_PUBLIC_KEY = exports.GOTRUE_ERRORS = exports.DATETIME_FORMAT = exports.DATE_FORMAT = exports.PROJECT_STATUS = exports.DOCS_URL = exports.IS_PLATFORM = void 0;
// Re-export from common package
var common_1 = require("common");
Object.defineProperty(exports, "IS_PLATFORM", { enumerable: true, get: function () { return common_1.IS_PLATFORM; } });
// Re-export from constants/index (correct path)
var index_1 = require("./constants/index");
Object.defineProperty(exports, "DOCS_URL", { enumerable: true, get: function () { return index_1.DOCS_URL; } });
Object.defineProperty(exports, "PROJECT_STATUS", { enumerable: true, get: function () { return index_1.PROJECT_STATUS; } });
Object.defineProperty(exports, "DATE_FORMAT", { enumerable: true, get: function () { return index_1.DATE_FORMAT; } });
Object.defineProperty(exports, "DATETIME_FORMAT", { enumerable: true, get: function () { return index_1.DATETIME_FORMAT; } });
Object.defineProperty(exports, "GOTRUE_ERRORS", { enumerable: true, get: function () { return index_1.GOTRUE_ERRORS; } });
Object.defineProperty(exports, "STRIPE_PUBLIC_KEY", { enumerable: true, get: function () { return index_1.STRIPE_PUBLIC_KEY; } });
Object.defineProperty(exports, "POSTHOG_URL", { enumerable: true, get: function () { return index_1.POSTHOG_URL; } });
Object.defineProperty(exports, "USAGE_APPROACHING_THRESHOLD", { enumerable: true, get: function () { return index_1.USAGE_APPROACHING_THRESHOLD; } });
Object.defineProperty(exports, "OPT_IN_TAGS", { enumerable: true, get: function () { return index_1.OPT_IN_TAGS; } });
Object.defineProperty(exports, "GB", { enumerable: true, get: function () { return index_1.GB; } });
Object.defineProperty(exports, "MB", { enumerable: true, get: function () { return index_1.MB; } });
Object.defineProperty(exports, "KB", { enumerable: true, get: function () { return index_1.KB; } });
Object.defineProperty(exports, "PROVIDERS", { enumerable: true, get: function () { return index_1.PROVIDERS; } });
Object.defineProperty(exports, "useDefaultProvider", { enumerable: true, get: function () { return index_1.useDefaultProvider; } });
Object.defineProperty(exports, "MANAGED_BY", { enumerable: true, get: function () { return index_1.MANAGED_BY; } });
Object.defineProperty(exports, "PRICING_TIER_LABELS_ORG", { enumerable: true, get: function () { return index_1.PRICING_TIER_LABELS_ORG; } });
Object.defineProperty(exports, "PRICING_TIER_PRODUCT_IDS", { enumerable: true, get: function () { return index_1.PRICING_TIER_PRODUCT_IDS; } });
Object.defineProperty(exports, "PASSWORD_STRENGTH", { enumerable: true, get: function () { return index_1.PASSWORD_STRENGTH; } });
Object.defineProperty(exports, "PASSWORD_STRENGTH_COLOR", { enumerable: true, get: function () { return index_1.PASSWORD_STRENGTH_COLOR; } });
Object.defineProperty(exports, "PASSWORD_STRENGTH_PERCENTAGE", { enumerable: true, get: function () { return index_1.PASSWORD_STRENGTH_PERCENTAGE; } });
Object.defineProperty(exports, "DEFAULT_MINIMUM_PASSWORD_STRENGTH", { enumerable: true, get: function () { return index_1.DEFAULT_MINIMUM_PASSWORD_STRENGTH; } });
Object.defineProperty(exports, "DEFAULT_PROJECT_API_SERVICE_ID", { enumerable: true, get: function () { return index_1.DEFAULT_PROJECT_API_SERVICE_ID; } });
Object.defineProperty(exports, "INSTANCE_NANO_SPECS", { enumerable: true, get: function () { return index_1.INSTANCE_NANO_SPECS; } });
Object.defineProperty(exports, "INSTANCE_MICRO_SPECS", { enumerable: true, get: function () { return index_1.INSTANCE_MICRO_SPECS; } });
Object.defineProperty(exports, "PG_META_URL", { enumerable: true, get: function () { return index_1.PG_META_URL; } });
Object.defineProperty(exports, "AWS_REGIONS_DEFAULT", { enumerable: true, get: function () { return index_1.AWS_REGIONS_DEFAULT; } });
Object.defineProperty(exports, "FLY_REGIONS_DEFAULT", { enumerable: true, get: function () { return index_1.FLY_REGIONS_DEFAULT; } });
// Studio-specific constants
exports.API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
exports.BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
// Environment detection
exports.IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
exports.IS_PRODUCTION = process.env.NODE_ENV === 'production';
exports.IS_TEST = process.env.NODE_ENV === 'test';
