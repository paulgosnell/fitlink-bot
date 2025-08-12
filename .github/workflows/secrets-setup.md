# GitHub Secrets Setup

## Required Secrets for Automated Deployment

### SUPABASE_ACCESS_TOKEN
```
sbp_12936c9630a4c9ac7f770e1a5683f9f6bd41a691
```

### SUPABASE_PROJECT_REF
```
umixefoxgjmdlvvtfnmr
```

## How to Add These Secrets

1. Go to your GitHub repository: https://github.com/paulgosnell/fitlink-bot
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the exact names and values above

## What Happens Next

Once these secrets are added:
- GitHub Actions will automatically deploy all functions to Supabase
- Your bot will be fully functional with all fixes
- OAuth flows, settings, and data sync will work properly