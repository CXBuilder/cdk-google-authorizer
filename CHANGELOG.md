# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-04-17)

Full rewrite. Previously this repo shipped a legacy SAM template and generic-OIDC
JavaScript handler (forked from `aws-samples/lambdaedge-openidconnect-samples`).
It's now a published CDK construct purpose-built for Google OAuth.

- Google-first Lambda@Edge authorizer:
  - Hardcoded Google OIDC endpoints (no discovery-doc round trip on cold start)
  - Hosted-domain (`hd`) enforcement for Google Workspace
  - Optional email allow-list
- Two L2 CDK constructs:
  - `GoogleAuthorizer` — attach the edge lambda to any CloudFront behavior
  - `ProtectedStaticSite` — S3 + CloudFront + authorizer in one construct
- TypeScript source for both the constructs and the Lambda handler
- `jose` replaces `jsonwebtoken` + `jwk-to-pem` + `axios` + `base64url`;
  Lambda bundle is a single esbuild-minified file (~470 KB, well under the
  Lambda@Edge 1 MB limit)
- `TOKEN` cookie now sets `HttpOnly`, `Secure`, and `SameSite=Lax`
- Runtime upgraded to Node.js 22.x
- Redirect URI derived from the request `Host` header — same function works
  with any alias on the distribution, including CloudFront default domains
- GitHub Actions CI publishes to GitHub Packages automatically on `main` when
  the version is bumped (see `.github/workflows/ci-cd.yml`)
- Jest test suite covering session JWT, nonce, cookies, Google redirect URL,
  and CDK-template assertions for both constructs
