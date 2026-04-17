#!/usr/bin/env node
import * as path from 'path';
import { App, CfnOutput, Duration, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import { ProtectedStaticSite } from '../src';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error(
    'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running `cdk deploy`.\n' +
      'Create credentials at https://console.cloud.google.com/apis/credentials.'
  );
}

const hostedDomain = process.env.GOOGLE_HOSTED_DOMAIN;

const app = new App();
const stack = new Stack(app, 'GoogleAuthorizerIntegTest', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  description: 'Smoke-test stack for @cxbuilder/google-authorizer',
});

const site = new ProtectedStaticSite(stack, 'Site', {
  siteSource: Source.asset(path.join(__dirname, 'website')),
  clientId,
  clientSecret: SecretValue.unsafePlainText(clientSecret),
  hostedDomain,
  sessionDuration: Duration.hours(1),
  removalPolicy: RemovalPolicy.DESTROY,
});

new CfnOutput(stack, 'CloudFrontDomain', {
  value: site.distribution.distributionDomainName,
  description: 'Visit this URL to start the Google OAuth flow.',
});

new CfnOutput(stack, 'CallbackUrl', {
  value: `https://${site.distribution.distributionDomainName}/_callback`,
  description: 'Add this URL to your Google OAuth client authorized redirect URIs.',
});
