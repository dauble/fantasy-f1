# GitHub Actions CI/CD Setup

Quick guide for setting up automatic deployments to Fly.io via GitHub Actions.

## Prerequisites

- GitHub repository with your Fantasy F1 code
- Fly.io app already created (`flyctl apps create`)
- Fly.io CLI installed locally

## Steps

### 1. Get Your Fly.io API Token

Run this command locally:

```bash
flyctl auth token
```

Copy the output token (it will look like: `fo1_xxxxxxxxxxxxxxxxxxxx`)

### 2. Add Secret to GitHub Repository

1. Go to your GitHub repository page
2. Click **Settings** (top navigation)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click the green **New repository secret** button
5. Fill in:
   - **Name**: `FLY_API_TOKEN`
   - **Secret**: Paste your token from step 1
6. Click **Add secret**

### 3. Verify fly.toml Configuration

Ensure your `fly.toml` file has the correct app name:

```toml
app = 'your-actual-fly-app-name'  # Must match your Fly.io app
primary_region = 'iad'
```

### 4. Commit and Push

The workflow is already set up in `.github/workflows/deploy.yml`. Just push to main:

```bash
git add .
git commit -m "Setup CI/CD with GitHub Actions"
git push origin main
```

### 5. Watch the Deployment

1. Go to your GitHub repository
2. Click the **Actions** tab
3. You should see a workflow run starting
4. Click on it to watch the deployment progress

## What Happens on Each Push

1. GitHub Actions detects a push to `main` branch
2. Checks out your code
3. Sets up Fly CLI
4. Runs `flyctl deploy --remote-only`
5. Your app is updated on Fly.io automatically!

## Deployment Time

- **First deployment**: ~3-5 minutes
- **Subsequent deployments**: ~2-3 minutes

## Workflow File

The workflow is defined in `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy app
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Fly CLI
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## Troubleshooting

### "Error: Could not find App"

**Problem**: Fly.io can't find your app

**Solution**:

1. Check your `fly.toml` app name matches exactly
2. Verify app exists: `flyctl apps list`
3. Create if needed: `flyctl apps create your-app-name`

### "Error: No access token provided"

**Problem**: GitHub secret not configured correctly

**Solution**:

1. Verify secret name is exactly `FLY_API_TOKEN` (case-sensitive)
2. Generate new token: `flyctl auth token`
3. Update GitHub secret with new token

### "Build failed"

**Problem**: Docker build error

**Solution**:

1. Test build locally: `npm run build`
2. Check GitHub Actions logs for specific error
3. Ensure all dependencies in `package.json`
4. Try deploying manually: `flyctl deploy`

### Deployment Stuck or Slow

**Problem**: Workflow taking too long

**Solution**:

- Check Fly.io status: https://status.fly.io
- View deployment logs: `flyctl logs`
- Cancel and retry: Go to Actions → Cancel workflow → Push again

## Benefits of CI/CD

✅ **Automatic deployments** - No manual steps after initial setup
✅ **Faster workflow** - Push code and it's live in minutes
✅ **Version control** - Every deployment tied to a commit
✅ **Rollback capability** - Easy to revert via Fly.io dashboard
✅ **Team collaboration** - Anyone with push access can deploy

## Optional: Deploy from Other Branches

To deploy from branches other than `main`, edit `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches:
      - main
      - staging # Add more branches
      - production
```

## Optional: Deploy on Pull Request

To preview deployments on PRs, add a new workflow:

```yaml
name: Preview Deployment

on:
  pull_request:
    branches:
      - main

jobs:
  preview:
    name: Deploy preview
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --app your-app-name-pr-${{ github.event.number }}
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## Security Notes

- ✅ `FLY_API_TOKEN` is encrypted in GitHub
- ✅ Only visible to workflow runs
- ✅ Not visible in logs or to other users
- ⚠️ Never commit the token to your repository
- ⚠️ Rotate token if compromised: `flyctl auth token`

## Next Steps

Once CI/CD is working:

1. **Monitor deployments** in GitHub Actions tab
2. **Set up notifications** (Settings → Notifications → Actions)
3. **Add status badge** to README (optional)
4. **Create staging environment** (separate Fly.io app)

---

**Need help?** See the full [Deployment Guide](DEPLOYMENT.md)
