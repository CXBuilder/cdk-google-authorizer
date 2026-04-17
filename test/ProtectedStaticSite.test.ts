import { App, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { ProtectedStaticSite } from '../src';
import { generateSigningKeyPair } from '../src/generateSigningKeyPair';

const keyPair = generateSigningKeyPair();

function makeApp() {
  const app = new App();
  const stack = new Stack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  return { app, stack };
}

// Use the integ website as a concrete source — avoids stubbing.
const siteSource = Source.asset(path.join(__dirname, '..', 'integ', 'website'));

describe('ProtectedStaticSite', () => {
  test('creates content bucket, log bucket, distribution, authorizer, and deployment', () => {
    const { stack } = makeApp();
    new ProtectedStaticSite(stack, 'Site', {
      siteSource,
      clientId: 'x.apps.googleusercontent.com',
      clientSecret: SecretValue.unsafePlainText('s'),
      hostedDomain: 'cxbuilder.ai',
      removalPolicy: RemovalPolicy.DESTROY,
      signingKeyPair: keyPair,
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::S3::Bucket', 2); // content + log
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          LambdaFunctionAssociations: Match.arrayWith([
            Match.objectLike({ EventType: 'viewer-request' }),
          ]),
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
      }),
    });
  });

  test('throws when domainNames set without certificate', () => {
    const { stack } = makeApp();
    expect(
      () =>
        new ProtectedStaticSite(stack, 'Site', {
          siteSource,
          clientId: 'x',
          clientSecret: SecretValue.unsafePlainText('s'),
          domainNames: ['example.com'],
          signingKeyPair: keyPair,
        })
    ).toThrow(/certificate/);
  });
});
