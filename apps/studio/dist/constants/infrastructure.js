"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTANCE_MICRO_SPECS = exports.INSTANCE_NANO_SPECS = exports.DEFAULT_PROJECT_API_SERVICE_ID = exports.PASSWORD_STRENGTH_PERCENTAGE = exports.PASSWORD_STRENGTH_COLOR = exports.PASSWORD_STRENGTH = exports.DEFAULT_MINIMUM_PASSWORD_STRENGTH = exports.PROJECT_STATUS = exports.PROVIDERS = exports.PRICING_TIER_PRODUCT_IDS = exports.PRICING_TIER_LABELS_ORG = exports.MANAGED_BY = exports.FLY_REGIONS_DEFAULT = exports.AWS_REGIONS_DEFAULT = void 0;
exports.useDefaultProvider = useDefaultProvider;
const shared_data_1 = require("shared-data");
const useCustomContent_1 = require("hooks/custom-content/useCustomContent");
exports.AWS_REGIONS_DEFAULT = process.env.NEXT_PUBLIC_ENVIRONMENT !== 'prod'
    ? shared_data_1.AWS_REGIONS.SOUTHEAST_ASIA
    : shared_data_1.AWS_REGIONS.EAST_US_2;
// TO DO, change default to US region for prod
exports.FLY_REGIONS_DEFAULT = shared_data_1.FLY_REGIONS.SOUTHEAST_ASIA;
exports.MANAGED_BY = {
    VERCEL_MARKETPLACE: 'vercel-marketplace',
    AWS_MARKETPLACE: 'aws-marketplace',
    SUPABASE: 'supabase',
};
exports.PRICING_TIER_LABELS_ORG = {
    FREE: 'Free - $0/month',
    PRO: 'Pro - $25/month',
    TEAM: 'Team - $599/month',
};
exports.PRICING_TIER_PRODUCT_IDS = {
    FREE: 'tier_free',
    PRO: 'tier_pro',
    PAYG: 'tier_payg',
    TEAM: 'tier_team',
    ENTERPRISE: 'tier_enterprise',
};
function useDefaultProvider() {
    const defaultProvider = process.env.NEXT_PUBLIC_ENVIRONMENT &&
        ['staging', 'preview'].includes(process.env.NEXT_PUBLIC_ENVIRONMENT)
        ? 'AWS_K8S'
        : 'AWS';
    const { infraCloudProviders: validCloudProviders } = (0, useCustomContent_1.useCustomContent)(['infra:cloud_providers']);
    if (validCloudProviders?.includes(defaultProvider)) {
        return defaultProvider;
    }
    return (validCloudProviders?.[0] ?? 'AWS');
}
exports.PROVIDERS = {
    FLY: {
        id: 'FLY',
        name: 'Fly.io',
        default_region: exports.FLY_REGIONS_DEFAULT,
        regions: { ...shared_data_1.FLY_REGIONS },
    },
    AWS: {
        id: 'AWS',
        name: 'AWS',
        DEFAULT_SSH_KEY: 'supabase-app-instance',
        default_region: exports.AWS_REGIONS_DEFAULT,
        regions: { ...shared_data_1.AWS_REGIONS },
    },
    AWS_K8S: {
        id: 'AWS_K8S',
        name: 'AWS (Revamped)',
        DEFAULT_SSH_KEY: 'supabase-app-instance',
        default_region: exports.AWS_REGIONS_DEFAULT,
        regions: { ...shared_data_1.AWS_REGIONS },
    },
    AWS_NIMBUS: {
        id: 'AWS_NIMBUS',
        name: 'AWS (Nimbus)',
        default_region: exports.AWS_REGIONS_DEFAULT,
        regions: { ...shared_data_1.AWS_REGIONS },
    },
};
exports.PROJECT_STATUS = {
    INACTIVE: 'INACTIVE',
    ACTIVE_HEALTHY: 'ACTIVE_HEALTHY',
    ACTIVE_UNHEALTHY: 'ACTIVE_UNHEALTHY',
    COMING_UP: 'COMING_UP',
    UNKNOWN: 'UNKNOWN',
    GOING_DOWN: 'GOING_DOWN',
    INIT_FAILED: 'INIT_FAILED',
    REMOVED: 'REMOVED',
    RESTARTING: 'RESTARTING',
    RESTORING: 'RESTORING',
    RESTORE_FAILED: 'RESTORE_FAILED',
    UPGRADING: 'UPGRADING',
    PAUSING: 'PAUSING',
    PAUSE_FAILED: 'PAUSE_FAILED',
    RESIZING: 'RESIZING',
};
exports.DEFAULT_MINIMUM_PASSWORD_STRENGTH = 4;
exports.PASSWORD_STRENGTH = {
    0: 'This password is not acceptable.',
    1: 'This password is not secure enough.',
    2: 'This password is not secure enough.',
    3: 'Not bad, but your password must be harder to guess.',
    4: 'This password is strong.',
};
exports.PASSWORD_STRENGTH_COLOR = {
    0: 'bg-red-900',
    1: 'bg-red-900',
    2: 'bg-yellow-900',
    3: 'bg-yellow-900',
    4: 'bg-green-900',
};
exports.PASSWORD_STRENGTH_PERCENTAGE = {
    0: '10%',
    1: '30%',
    2: '50%',
    3: '80%',
    4: '100%',
};
exports.DEFAULT_PROJECT_API_SERVICE_ID = 1;
exports.INSTANCE_NANO_SPECS = {
    baseline_disk_io_mbs: 43,
    connections_direct: 30,
    connections_pooler: 200,
    cpu_cores: 'Shared',
    cpu_dedicated: false,
    max_disk_io_mbs: 2085,
    memory_gb: 0.5,
};
exports.INSTANCE_MICRO_SPECS = {
    baseline_disk_io_mbs: 87,
    connections_direct: 60,
    connections_pooler: 200,
    cpu_cores: 2,
    cpu_dedicated: false,
    max_disk_io_mbs: 2085,
    memory_gb: 1,
};
