import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  // Long-lived access + refresh; a new login bumps sessionVersion and kicks other devices.
  JWT_ACCESS_TTL: Joi.string().default('30d'),
  JWT_REFRESH_TTL: Joi.string().default('3650d'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  LOG_LEVEL: Joi.string().default('info'),
  FIREBASE_PROJECT_ID: Joi.string().optional().allow(''),
  APNS_KEY_ID: Joi.string().optional().allow(''),
  APNS_TEAM_ID: Joi.string().optional().allow(''),
  APNS_BUNDLE_ID: Joi.string().optional().allow(''),
  APNS_KEY_PATH: Joi.string().optional().allow(''),
  APNS_KEY_BASE64: Joi.string().optional().allow(''),
  APNS_PRODUCTION: Joi.boolean().truthy('true').falsy('false').default(false),
  BREVO_API_KEY: Joi.string().optional().allow(''),
  BREVO_SENDER_EMAIL: Joi.string().email().default('contact@tecnowallet.app'),
  BREVO_SENDER_NAME: Joi.string().default('TecnoWallet'),
  RECAUDO_INVITE_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:8081/invite'),
  UNIT_API_URL: Joi.string().uri().default('https://api.s.unit.sh'),
  UNIT_API_TOKEN: Joi.string().optional().allow(''),
  UNIT_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  BRIDGE_API_URL: Joi.string()
    .uri()
    .default('https://api.sandbox.bridge.xyz'),
  BRIDGE_API_KEY: Joi.string().optional().allow(''),
  BRIDGE_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  UNIT_WALLET_TERMS: Joi.string().default('walletDefault'),
  /** Deposit product id for individual-customer recaudo accounts (sandbox: checking). */
  UNIT_DEPOSIT_PRODUCT: Joi.string().default('checking'),
  GOOGLE_CLIENT_ID_WEB: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_ID_IOS: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  BELVO_SECRET_ID: Joi.string().optional().allow(''),
  BELVO_SECRET_PASSWORD: Joi.string().optional().allow(''),
  BELVO_API_URL: Joi.string().uri().default('https://sandbox.belvo.com'),
  OPENAI_API_KEY: Joi.string().optional().allow(''),
  OPENAI_MODEL_FAST: Joi.string().default('gpt-4o-mini'),
  OPENAI_MODEL_COMPLEX: Joi.string().default('gpt-4o'),
  REVENUECAT_SECRET_API_KEY: Joi.string().optional().allow(''),
  REVENUECAT_WEBHOOK_AUTH: Joi.string().optional().allow(''),
  REVENUECAT_ENTITLEMENT_ID: Joi.string().default('plus'),
  REVENUECAT_BUSINESS_ENTITLEMENT_ID: Joi.string().default('business'),
  PLUS_ENFORCEMENT_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  RUN_FREEMIUM_MIGRATIONS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  BRANCH_SECRET: Joi.string().optional().allow(''),
  BRANCH_DEFAULT_DOMAIN: Joi.string().default('tecnowallet.app.link'),
  PUBLIC_WEB_ORIGIN: Joi.string().uri().default('https://tecnowallet.app'),
  ADMIN_BOOTSTRAP_EMAIL: Joi.string().email().optional().allow(''),
  ADMIN_BOOTSTRAP_PASSWORD: Joi.string().optional().allow(''),
});

export function validateEnvironment(config: Record<string, unknown>) {
  // Joi's public validation result intentionally exposes an `any` value.
  // Convert it at this single configuration boundary.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { error, value } = schema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });
  if (error) {
    throw new Error(`Invalid environment: ${error.message}`);
  }
  return value as Record<string, unknown>;
}
