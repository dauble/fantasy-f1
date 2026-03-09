# Fly.io Deployment Guide

This guide walks you through deploying the Fantasy F1 application to Fly.io.

## Prerequisites

1. **Fly.io account**: Sign up at https://fly.io/app/sign-up
2. **Fly CLI installed**:

   ```bash
   # macOS
   brew install flyctl

   # Linux
   curl -L https://fly.io/install.sh | sh

   # Windows
   iwr https://fly.io/install.ps1 -useb | iex
   ```

## Initial Setup

### 1. Login to Fly.io

```bash
flyctl auth login
```

This will open your browser for authentication.

### 2. Choose Your App Name

Edit `fly.toml` and change the app name (must be globally unique):

```toml
app = 'your-unique-app-name'  # Change this
primary_region = 'iad'        # Optional: change region
```

**Available regions**: Run `flyctl platform regions` to see options

- `iad` - Virginia, USA (default)
- `lhr` - London, UK
- `syd` - Sydney, Australia
- `fra` - Frankfurt, Germany

### 3. Create the App

```bash
flyctl apps create your-unique-app-name
```

Or let Fly.io generate a name:

```bash
flyctl apps create
```

### 4. Configure Secrets (Optional - For AI Predictions)

If you want to use the AI-powered Predictions feature, you need to set your Anthropic API key:

```bash
flyctl secrets set ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

**Getting an API Key**:

1. Sign up at [console.anthropic.com](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Create a new API key (starts with `sk-ant-`)
4. Copy and use it in the command above

⚠️ **Important**: Never commit API keys to your repository. Always use Fly secrets.

**Note**: The app will work without this secret, but the AI Predictions page will show an error. All other features function normally.

## Deployment

### Deploy the Application

```bash
flyctl deploy
```

This will:

1. Build the Docker image with multi-stage build
2. Push the image to Fly.io registry
3. Deploy the container
4. Start the application

### Open Your Application

```bash
flyctl open
```

Your app will be available at: `https://your-app-name.fly.dev`

## Continuous Deployment with GitHub Actions

The repository includes a GitHub Actions workflow that automatically deploys to Fly.io when you push to the `main` branch.

### Setup CI/CD

#### 1. Get Your Fly.io API Token

```bash
flyctl auth token
```

This will output your personal Fly.io API token. Copy it.

#### 2. Add Secret to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FLY_API_TOKEN`
5. Value: Paste your token from step 1
6. Click **Add secret**

#### 3. Update fly.toml

Make sure your `fly.toml` has the correct app name:

```toml
app = 'your-actual-fly-app-name'
```

#### 4. Push to Main Branch

Once configured, every push to `main` will trigger automatic deployment:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### How It Works

The workflow file (`.github/workflows/deploy.yml`):

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

**Key Features**:

- Triggers on push to `main` branch
- Uses `--remote-only` flag (builds on Fly.io servers, not GitHub runners)
- Faster than local builds
- Doesn't require Docker on GitHub runners

### View Deployment Status

Check deployment progress:

1. Go to your GitHub repository
2. Click the **Actions** tab
3. Click on the latest workflow run
4. Watch the deployment logs in real-time

### Troubleshooting CI/CD

**Deployment fails with authentication error**:

- Verify `FLY_API_TOKEN` secret is correctly set
- Token may have expired - generate a new one with `flyctl auth token`

**Deployment fails with "app not found"**:

- Ensure `fly.toml` app name matches your Fly.io app name
- Run `flyctl apps list` to see your apps

**Build fails**:

- Check the Actions logs for specific error messages
- Test the build locally first: `npm run build`

## Managing Your Deployment

### View Logs

```bash
# Follow logs in real-time
flyctl logs

# View specific number of lines
flyctl logs -n 100
```

### Check Application Status

```bash
flyctl status
```

### View Application Info

```bash
flyctl info
```

### Scale Resources (if needed)

```bash
# Scale memory
flyctl scale memory 512

# Scale VMs
flyctl scale count 2

# View current scaling
flyctl scale show
```

### Update App Configuration

After editing `fly.toml`:

```bash
flyctl deploy
```

## Monitoring

### Health Checks

The Express server includes a `/health` endpoint that Fly.io monitors:

- Interval: 30 seconds
- Timeout: 10 seconds
- Auto-restart on failure

### View Metrics

```bash
flyctl metrics
```

Or visit: https://fly.io/apps/your-app-name/metrics

## Updating Your Application

1. Make code changes locally
2. Commit to git (optional but recommended)
3. Deploy:
   ```bash
   flyctl deploy
   ```

### Rollback a Deployment

If something goes wrong:

```bash
# List recent releases
flyctl releases

# Rollback to previous version
flyctl releases rollback
```

## Cost & Scaling

### Free Tier Limits

- 3 shared-cpu-1x VMs (256MB RAM each)
- 3GB persistent storage
- 160GB outbound data transfer/month

### Auto-Scaling Configuration

Your app is configured to auto-scale:

```toml
[http_service]
  auto_stop_machines = true   # Stop when no traffic
  auto_start_machines = true  # Start on incoming requests
  min_machines_running = 1
  max_machines_running = 3
```

This keeps costs low while maintaining availability.

## Troubleshooting

### Build Fails

```bash
# View build logs
flyctl logs

# Try a clean build
flyctl deploy --no-cache
```

### App Won't Start

```bash
# Check logs
flyctl logs

# SSH into the container
flyctl ssh console

# Verify Node/Express is running
flyctl ssh console -C "ps aux | grep node"
```

### DNS/SSL Issues

```bash
# Check certificates
flyctl certs list

# Force certificate renewal
flyctl certs check your-app-name.fly.dev
```

### Connection Issues

```bash
# Test from command line
curl -v https://your-app-name.fly.dev

# Check internal connectivity
flyctl ssh console -C "curl http://localhost:8080/health"
```

## Custom Domain (Optional)

### Add Your Domain

```bash
flyctl certs create yourdomain.com
flyctl certs create www.yourdomain.com
```

### Update DNS

Add these records to your DNS provider:

```
Type    Name    Value
A       @       (IP provided by Fly.io)
AAAA    @       (IPv6 provided by Fly.io)
CNAME   www     your-app-name.fly.dev
```

### Verify Certificate

```bash
flyctl certs check yourdomain.com
```

## Useful Commands Reference

```bash
# Authentication
flyctl auth login
flyctl auth logout

# App management
flyctl apps list
flyctl apps destroy your-app-name

# Deployment
flyctl deploy
flyctl deploy --remote-only  # Build on Fly.io servers
flyctl deploy --no-cache     # Force clean build

# Monitoring
flyctl status
flyctl logs
flyctl logs --follow
flyctl metrics

# Scaling
flyctl scale show
flyctl scale count 2
flyctl scale memory 512

# Releases
flyctl releases
flyctl releases rollback

# SSH access
flyctl ssh console
flyctl ssh console -C "ls -la"

# Configuration
flyctl config save    # Download current config
flyctl config display # Show config

# Regions
flyctl platform regions
flyctl regions list
```

## Architecture

### Deployment Stack

```
[Client Browser]
      ↓ HTTPS
[Fly.io Proxy (SSL, Load Balancing)]
      ↓ HTTP/8080
[nginx Alpine Container]
      ↓
[React/Vite Static Files in /usr/share/nginx/html]
      ↓
[LocalStorage API (runs in browser)]
```

### Docker Build Process

1. **Stage 1 (Builder)**:
   - Node.js 20 Alpine image
   - Install dependencies with `npm ci`
   - Build React/Vite app with `npm run build`
   - Generate optimized static files in `dist/`

2. **Stage 2 (Production)**:
   - nginx Alpine image (~25MB)
   - Copy built files from Stage 1
   - Copy nginx configuration
   - Expose port 8080
   - Start nginx server

**Final image size**: ~30MB (vs ~1GB+ for Node-based image)

## Security

### HTTPS

- Fly.io automatically provisions SSL certificates
- `force_https = true` redirects HTTP → HTTPS
- Certificates auto-renew

### Security Headers

nginx adds these headers:

- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection

### Storage

- All data stored in browser localStorage (client-side)
- No server-side storage or databases
- No sensitive data transmitted to server

## Performance

### Optimizations

- **Gzip compression** enabled for text assets
- **Static asset caching** (1 year for immutable files)
- **Multi-stage build** (minimal image size)
- **Auto-stop/start** (near-instant cold starts)

### Expected Performance

- **Cold start**: < 1 second
- **Warm response**: < 100ms
- **Build time**: ~2-3 minutes
- **Deploy time**: ~3-5 minutes total

## Support

- **Fly.io Docs**: https://fly.io/docs
- **Fly.io Community**: https://community.fly.io
- **Fly.io Status**: https://status.fly.io

---

Happy deploying! 🚀
