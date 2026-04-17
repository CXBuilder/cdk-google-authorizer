# Creating a Google OAuth 2.0 client

This construct needs a Google OAuth 2.0 **Web Application** client ID and client secret.

## Steps

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2. Pick (or create) the project that will own this OAuth client.
3. Click **Create Credentials → OAuth client ID**.
4. If prompted, configure the OAuth consent screen first:
   - User type: **Internal** if this is a Google Workspace org; **External** otherwise
   - App name, support email, developer contact email
   - Scopes: `openid`, `email`, `profile`
5. Application type: **Web application**.
6. Name it (e.g. `cdk-google-authorizer-prod`).
7. **Authorized redirect URIs** — add one entry per distribution you'll protect:
   - `https://<your-cloudfront-domain>/_callback`
   - If you're using a custom domain: `https://<custom-domain>/_callback`
   - For initial CloudFront default-domain deploys, you'll need to come back and add
     the real `d1a2b3c4d5.cloudfront.net` URL after the first `cdk deploy`.
8. Click **Create**. Copy the client ID and client secret.

## Storing the credentials

**Do not commit the client secret to git.** Options:

- **AWS Secrets Manager** (recommended for production):
  ```bash
  aws secretsmanager create-secret --name google-oauth/my-app \
    --secret-string '{"clientId": "xxx.apps.googleusercontent.com", "clientSecret": "GOCSPX-..."}'
  ```
  Then in CDK:
  ```typescript
  new GoogleAuthorizer(this, 'Auth', {
    clientId: 'xxx.apps.googleusercontent.com',
    clientSecret: SecretValue.secretsManager('google-oauth/my-app', { jsonField: 'clientSecret' }),
    hostedDomain: 'cxbuilder.ai',
  });
  ```

- **Environment variable** (acceptable for local tests only):
  ```typescript
  clientSecret: SecretValue.unsafePlainText(process.env.GOOGLE_CLIENT_SECRET!)
  ```

## Hosted-domain restriction

If your Google OAuth client is associated with a Google Workspace domain and you want
to reject any sign-in from outside that domain, set `hostedDomain` on the construct:

```typescript
new GoogleAuthorizer(this, 'Auth', {
  // ...
  hostedDomain: 'cxbuilder.ai',
});
```

This both passes `hd=cxbuilder.ai` to the Google auth URL (so the chooser only shows
accounts in that domain) AND validates the `hd` claim on the returned ID token (so
a sophisticated user can't bypass the chooser by editing the URL).

## Further restriction with allowedEmails

For tighter control, combine `hostedDomain` with an explicit allow-list:

```typescript
new GoogleAuthorizer(this, 'Auth', {
  // ...
  hostedDomain: 'cxbuilder.ai',
  allowedEmails: ['alice@cxbuilder.ai', 'bob@cxbuilder.ai'],
});
```
