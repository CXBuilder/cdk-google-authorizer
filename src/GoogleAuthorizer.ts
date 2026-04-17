import * as fs from 'fs';
import * as path from 'path';
import { ArnFormat, Duration, SecretValue, Stack } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { generateSigningKeyPair, SigningKeyPair } from './generateSigningKeyPair';

export interface GoogleAuthorizerProps {
  /**
   * Google OAuth 2.0 Client ID.
   * Create one at https://console.cloud.google.com/apis/credentials — type "Web application".
   */
  readonly clientId: string;

  /**
   * Google OAuth 2.0 Client Secret. For production, prefer
   * `SecretValue.secretsManager('my-secret', { jsonField: 'clientSecret' })`.
   * For local/test runs, `SecretValue.unsafePlainText('GOCSPX-...')` is acceptable.
   */
  readonly clientSecret: SecretValue;

  /**
   * Restrict to a Google Workspace domain (adds `hd` to the auth URL and
   * enforces the `hd` claim on the returned ID token). e.g. `"cxbuilder.ai"`.
   */
  readonly hostedDomain?: string;

  /**
   * Optional email allow-list. If set, only these users may log in
   * (checked after `hostedDomain`).
   */
  readonly allowedEmails?: string[];

  /**
   * Session cookie lifetime. @default Duration.hours(1)
   */
  readonly sessionDuration?: Duration;

  /**
   * Path on the CloudFront distribution that handles the OAuth callback.
   * Must be added to the Google OAuth client's authorized redirect URIs
   * as `https://<your-domain><callbackPath>`. @default "/_callback"
   */
  readonly callbackPath?: string;

  /**
   * Pre-existing RSA key pair (PEM) for signing session JWTs. If omitted,
   * a new 2048-bit key pair is generated at synth time. Provide one of your
   * own if you need signing keys to be stable across re-deploys.
   */
  readonly signingKeyPair?: SigningKeyPair;
}

/**
 * Lambda@Edge authorizer that gates CloudFront requests behind Google OAuth.
 *
 * Attach the edge function to any CloudFront behavior via `bindToBehavior()`,
 * then call `attachToDistribution(distribution)` so the authorizer can locate
 * its config secret at runtime.
 */
export class GoogleAuthorizer extends Construct {
  /** The Lambda@Edge function — use `edgeFunction.currentVersion` in edge-lambda associations. */
  readonly edgeFunction: cloudfront.experimental.EdgeFunction;

  private readonly configJson: string;

  constructor(scope: Construct, id: string, props: GoogleAuthorizerProps) {
    super(scope, id);

    const callbackPath = props.callbackPath ?? '/_callback';
    const sessionDurationSeconds = (props.sessionDuration ?? Duration.hours(1)).toSeconds();
    const keyPair = props.signingKeyPair ?? generateSigningKeyPair();

    // Build the runtime config JSON. The clientSecret token resolves at deploy time.
    const configObject = {
      clientId: props.clientId,
      clientSecret: props.clientSecret.unsafeUnwrap(),
      hostedDomain: props.hostedDomain,
      allowedEmails: props.allowedEmails,
      callbackPath,
      sessionDurationSeconds,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    };
    this.configJson = Stack.of(this).toJsonString(configObject);

    this.edgeFunction = new cloudfront.experimental.EdgeFunction(this, 'Fn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(resolveLambdaAssetPath()),
      timeout: Duration.seconds(5),
      memorySize: 128,
    });

    // Lambda@Edge can't use environment variables, so the handler looks up its config
    // at `cloudfront/{distributionId}` in Secrets Manager. Grant read on any such secret
    // in the current region; actual secret(s) are created by `attachToDistribution()`.
    this.edgeFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          Stack.of(this).formatArn({
            service: 'secretsmanager',
            region: 'us-east-1',
            resource: 'secret',
            resourceName: 'cloudfront/*',
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      })
    );
  }

  /** Convenience: returns the edge-lambda association to drop into a behavior. */
  bindToBehavior(): cloudfront.EdgeLambda {
    return {
      functionVersion: this.edgeFunction.currentVersion,
      eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
      includeBody: false,
    };
  }

  /**
   * Wires a specific distribution to this authorizer by creating a
   * `cloudfront/{distributionId}` Secrets Manager secret with the runtime config.
   * Call this once per distribution that uses the authorizer.
   */
  attachToDistribution(distribution: cloudfront.IDistribution): secretsmanager.Secret {
    const secret = new secretsmanager.Secret(this, `Config-${distribution.node.id}`, {
      secretName: `cloudfront/${distribution.distributionId}`,
      description: `Google authorizer config for CloudFront distribution ${distribution.distributionId}`,
      secretStringValue: SecretValue.unsafePlainText(this.configJson),
    });
    // Ensure the distribution is created first so its ID is known.
    secret.node.addDependency(distribution);
    return secret;
  }

  /**
   * The host-unknown-at-synth case: hand back the raw config JSON so callers
   * can create the secret themselves. Only needed for advanced use cases.
   */
  get configSecretString(): string {
    return this.configJson;
  }
}

/**
 * Finds the esbuild-bundled Lambda asset directory. At dev/test time __dirname
 * resolves to src/; the bundle lives at ../src/lambda/dist (from dist/) or
 * ./lambda/dist (from src/). Tries both.
 */
function resolveLambdaAssetPath(): string {
  const candidates = [
    path.join(__dirname, 'lambda', 'dist'),
    path.join(__dirname, '..', 'src', 'lambda', 'dist'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'handler.js'))) return p;
  }
  throw new Error(
    `Could not locate bundled Lambda handler. Run \`npm run bundle-lambda\`. Looked in: ${candidates.join(', ')}`
  );
}
