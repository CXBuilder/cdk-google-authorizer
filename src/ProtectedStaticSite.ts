import { Duration, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { GoogleAuthorizer } from './GoogleAuthorizer';
import { SigningKeyPair } from './generateSigningKeyPair';

export interface ProtectedStaticSiteProps {
  /** Source asset(s) for the static content. */
  readonly siteSource: s3deploy.ISource | s3deploy.ISource[];

  // --- GoogleAuthorizer pass-through props ---
  readonly clientId: string;
  readonly clientSecret: SecretValue;
  readonly hostedDomain?: string;
  readonly allowedEmails?: string[];
  readonly sessionDuration?: Duration;
  readonly callbackPath?: string;
  readonly signingKeyPair?: SigningKeyPair;

  // --- Distribution customization ---
  /** Optional custom domain names. Requires `certificate`. */
  readonly domainNames?: string[];
  /** ACM certificate in us-east-1 for the custom domain. Required if `domainNames` is set. */
  readonly certificate?: acm.ICertificate;
  /** @default 'index.html' */
  readonly defaultRootObject?: string;
  /** @default cloudfront.PriceClass.PRICE_CLASS_100 */
  readonly priceClass?: cloudfront.PriceClass;
  /** Removal policy for the buckets. @default RemovalPolicy.RETAIN */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * Static website on S3 + CloudFront, gated by Google OAuth via Lambda@Edge.
 * Closest drop-in replacement for the legacy SAM template.
 */
export class ProtectedStaticSite extends Construct {
  readonly bucket: s3.Bucket;
  readonly logBucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly authorizer: GoogleAuthorizer;

  constructor(scope: Construct, id: string, props: ProtectedStaticSiteProps) {
    super(scope, id);

    const removalPolicy = props.removalPolicy ?? RemovalPolicy.RETAIN;
    const autoDeleteObjects = removalPolicy === RemovalPolicy.DESTROY;

    this.logBucket = new s3.Bucket(this, 'LogBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      removalPolicy,
      autoDeleteObjects,
    });

    this.bucket = new s3.Bucket(this, 'ContentBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsBucket: this.logBucket,
      serverAccessLogsPrefix: 's3/',
      removalPolicy,
      autoDeleteObjects,
    });

    this.authorizer = new GoogleAuthorizer(this, 'Authorizer', {
      clientId: props.clientId,
      clientSecret: props.clientSecret,
      hostedDomain: props.hostedDomain,
      allowedEmails: props.allowedEmails,
      sessionDuration: props.sessionDuration,
      callbackPath: props.callbackPath,
      signingKeyPair: props.signingKeyPair,
    });

    if (props.domainNames && !props.certificate) {
      throw new Error('`certificate` is required when `domainNames` is set');
    }

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Google-authorized static site',
      defaultRootObject: props.defaultRootObject ?? 'index.html',
      priceClass: props.priceClass ?? cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      domainNames: props.domainNames,
      certificate: props.certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        edgeLambdas: [this.authorizer.bindToBehavior()],
      },
      logBucket: this.logBucket,
      logFilePrefix: 'cloudfront/',
    });

    this.authorizer.attachToDistribution(this.distribution);

    const sources = Array.isArray(props.siteSource) ? props.siteSource : [props.siteSource];
    new s3deploy.BucketDeployment(this, 'Deploy', {
      sources,
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });
  }
}
