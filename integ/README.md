# @cxbuilder/google-authorizer — integration smoke test

Deploys a `ProtectedStaticSite` to AWS so you can verify the Google OAuth flow end-to-end.

Not published as part of the package — only used for manual validation.

## Prerequisites

1. AWS credentials for the `cxbuilder-sam` profile:
   ```bash
   aws sso login --profile cxbuilder-sam
   ```

2. A Google OAuth 2.0 Web Application client. Create one at
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials):
   - Application type: **Web application**
   - Authorized redirect URIs: add a placeholder like `http://localhost/_callback`
     (you'll add the real CloudFront URL after the first deploy)
   - Copy the client ID and client secret

3. Node 22+ and `npm ci` run from the repo root.

## Deploy

```bash
# From the repo root, build the bundle that cdk will upload as the edge asset.
npm run build

cd integ

export GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-..."
# Optional: restrict to a Google Workspace domain
# export GOOGLE_HOSTED_DOMAIN="cxbuilder.ai"

npx cdk deploy --profile cxbuilder-sam
```

The stack outputs a `CloudFrontDomain` and a `CallbackUrl`.

## Finish the Google OAuth setup

CloudFront distribution domains aren't known until after deploy, so:

1. Copy the `CallbackUrl` output (e.g. `https://d1a2b3c4d5.cloudfront.net/_callback`)
2. Add it to your OAuth client's **Authorized redirect URIs** in Google Cloud Console
3. Save

## Test

Open the `CloudFrontDomain` URL in a browser:

- First request → 302 to `accounts.google.com`
- Sign in with a Google account
  - If `GOOGLE_HOSTED_DOMAIN` is set, must be a member of that Workspace domain
- Redirects back to the site and shows `Hello from @cxbuilder/google-authorizer`
- In devtools Application → Cookies, confirm the `TOKEN` cookie is `HttpOnly` + `Secure` + `SameSite=Lax`
- Reload the page — no second Google redirect until the cookie expires

### Negative tests

- Visit `/_callback` directly (no code) → 401
- Tamper with the `TOKEN` cookie value → redirected back to Google
- If `GOOGLE_HOSTED_DOMAIN` is set, sign in with a non-matching account → 401

## Tear down

```bash
npx cdk destroy --profile cxbuilder-sam
```

Lambda@Edge replicas take 15-30 min to clean up after a `destroy` — this is an AWS
limitation, not something the construct can work around. The CloudFormation stack
will delete quickly; the Lambda version hangs around until AWS removes the replicas.
