import { SecretsManager } from '@aws-sdk/client-secrets-manager';

export interface AuthorizerConfig {
  clientId: string;
  clientSecret: string;
  hostedDomain?: string;
  allowedEmails?: string[];
  callbackPath: string;
  sessionDurationSeconds: number;
  privateKey: string;
  publicKey: string;
}

let cachedConfig: AuthorizerConfig | undefined;
let cachedSecretId: string | undefined;

const sm = new SecretsManager({ region: 'us-east-1' });

export async function loadConfig(distributionId: string): Promise<AuthorizerConfig> {
  const secretId = `cloudfront/${distributionId}`;

  if (cachedConfig && cachedSecretId === secretId) return cachedConfig;

  const resp = await sm.getSecretValue({ SecretId: secretId });
  if (!resp.SecretString) throw new Error(`Secret ${secretId} is empty`);

  const parsed = JSON.parse(resp.SecretString) as AuthorizerConfig;
  cachedConfig = parsed;
  cachedSecretId = secretId;
  return parsed;
}

// Exposed for tests.
export function __resetConfigCache(): void {
  cachedConfig = undefined;
  cachedSecretId = undefined;
}
