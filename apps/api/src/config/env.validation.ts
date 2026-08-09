import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  // Persistent sessions: long-lived access + refresh (logout is explicit only).
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
  UNIT_WALLET_TERMS: Joi.string().default('walletDefault'),
  GOOGLE_CLIENT_ID_WEB: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_ID_IOS: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
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
