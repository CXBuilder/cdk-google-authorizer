# Contributing

Thanks for considering a contribution.

## Reporting bugs and feature requests

Use [GitHub Issues](https://github.com/cxbuilder/cdk-google-authorizer/issues).
Include:

- What you expected vs what happened
- A minimal reproducer (CDK snippet, request, or log line)
- The package version (`npm ls @cxbuilder/google-authorizer`)

## Pull requests

1. Fork and branch off `main`.
2. Make your change. Keep it focused — one PR per concern.
3. `npm run build && npm test` must pass.
4. Bump the version in `package.json` (SemVer) and add a `## x.y.z (YYYY-MM-DD)`
   entry at the top of [CHANGELOG.md](CHANGELOG.md). CI refuses to re-publish an
   existing version.
5. Open the PR; CI will run the test suite.

## Reporting security issues

**Please do not open a public GitHub issue.** Email `ivan@cxbuilder.ai` with
details and we'll coordinate a fix and disclosure timeline.

## Releases

Pushing to `main` with a bumped version number triggers the publish workflow
(`.github/workflows/ci-cd.yml`): it builds, runs tests, publishes to GitHub
Packages, tags the commit `vX.Y.Z`, and creates a GitHub Release from the
matching CHANGELOG entry. Publishing uses the built-in `GITHUB_TOKEN` — no
manual secret setup is required.
