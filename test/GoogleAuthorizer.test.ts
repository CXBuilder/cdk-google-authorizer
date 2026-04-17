import { App, Stack, SecretValue, Duration } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { GoogleAuthorizer } from '../src';
import { generateSigningKeyPair } from '../src/generateSigningKeyPair';

// Reuse a fixed key pair across tests so snapshots are stable.
const keyPair = generateSigningKeyPair();

function makeApp() {
  const app = new App();
  // The EdgeFunction construct requires a region; us-east-1 avoids the cross-region support stack.
  const stack = new Stack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  return { app, stack };
}

describe('GoogleAuthorizer', () => {
  test('creates a Lambda@Edge function with Node.js 22 runtime', () => {
    const { stack } = makeApp();
    new GoogleAuthorizer(stack, 'Auth', {
      clientId: 'x.apps.googleusercontent.com',
      clientSecret: SecretValue.unsafePlainText('secret'),
      signingKeyPair: keyPair,
    });
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Handler: 'handler.handler',
      Timeout: 5,
    });
  });

  test('grants the function permission to read cloudfront/* secrets', () => {
    const { stack } = makeApp();
    new GoogleAuthorizer(stack, 'Auth', {
      clientId: 'x',
      clientSecret: SecretValue.unsafePlainText('secret'),
      signingKeyPair: keyPair,
    });
    const template = Template.fromStack(stack);
    const policies = template.findResources('AWS::IAM::Policy');
    const statements = Object.values(policies).flatMap(
      (p: any) => p.Properties.PolicyDocument.Statement as unknown[]
    );
    const hasSecretsPolicy = statements.some(
      (s: any) =>
        s.Action === 'secretsmanager:GetSecretValue' &&
        JSON.stringify(s.Resource).includes('secret:cloudfront/*')
    );
    expect(hasSecretsPolicy).toBe(true);
  });

  test('bindToBehavior returns a VIEWER_REQUEST association', () => {
    const { stack } = makeApp();
    const auth = new GoogleAuthorizer(stack, 'Auth', {
      clientId: 'x',
      clientSecret: SecretValue.unsafePlainText('s'),
      signingKeyPair: keyPair,
    });
    const lambda = auth.bindToBehavior();
    expect(lambda.eventType).toBe(cloudfront.LambdaEdgeEventType.VIEWER_REQUEST);
    expect(lambda.includeBody).toBe(false);
  });

  test('attachToDistribution creates a secret named cloudfront/{distId}', () => {
    const { stack } = makeApp();
    const auth = new GoogleAuthorizer(stack, 'Auth', {
      clientId: 'x',
      clientSecret: SecretValue.unsafePlainText('s'),
      hostedDomain: 'cxbuilder.ai',
      allowedEmails: ['sam@sfr.io'],
      sessionDuration: Duration.minutes(30),
      signingKeyPair: keyPair,
    });
    const bucket = new s3.Bucket(stack, 'B');
    const dist = new cloudfront.Distribution(stack, 'D', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        edgeLambdas: [auth.bindToBehavior()],
      },
    });
    auth.attachToDistribution(dist);

    const template = Template.fromStack(stack);
    const secrets = template.findResources('AWS::SecretsManager::Secret');
    const names = Object.values(secrets).map(
      (s: any) => JSON.stringify(s.Properties.Name)
    );
    expect(names.some((n) => n.includes('cloudfront/'))).toBe(true);
  });

  test('config JSON embeds all expected fields with resolved client secret', () => {
    const { stack } = makeApp();
    const auth = new GoogleAuthorizer(stack, 'Auth', {
      clientId: 'xyz',
      clientSecret: SecretValue.unsafePlainText('s3cret'),
      hostedDomain: 'example.com',
      allowedEmails: ['a@b.c'],
      sessionDuration: Duration.minutes(15),
      signingKeyPair: keyPair,
    });
    const bucket = new s3.Bucket(stack, 'B');
    const dist = new cloudfront.Distribution(stack, 'D', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        edgeLambdas: [auth.bindToBehavior()],
      },
    });
    auth.attachToDistribution(dist);

    const template = Template.fromStack(stack);
    const secrets = template.findResources('AWS::SecretsManager::Secret');
    const [secret] = Object.values(secrets) as Array<{
      Properties: { SecretString: string };
    }>;
    const parsed = JSON.parse(secret.Properties.SecretString);
    expect(parsed).toMatchObject({
      clientId: 'xyz',
      clientSecret: 's3cret',
      hostedDomain: 'example.com',
      allowedEmails: ['a@b.c'],
      callbackPath: '/_callback',
      sessionDurationSeconds: 900,
    });
    expect(parsed.privateKey).toContain('BEGIN PRIVATE KEY');
    expect(parsed.publicKey).toContain('BEGIN PUBLIC KEY');
  });
});
