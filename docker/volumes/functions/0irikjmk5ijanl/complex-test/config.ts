// Updated configuration
export const config = {
  version: "2.0.0",
  environment: "development",
  features: {
    processing: true,
    validation: true,
    logging: true,
    newFeature: true
  },
  limits: {
    maxPayloadSize: 2 * 1024 * 1024, // 2MB - increased
    timeout: 45000 // 45 seconds - increased
  },
  updated: true
};