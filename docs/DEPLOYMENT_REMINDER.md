# Deployment Reminder for GitHub Copilot

## 🚨 **REMEMBER: GitHub Actions Handles Deployment**

This project uses **GitHub Actions** for automatic deployment of Supabase Edge Functions.

### How It Works:
1. **Code changes** are made to files in `supabase/functions/`
2. **Git commit and push** to the `main` branch
3. **GitHub Actions automatically deploys** to Supabase

### Deployment Commands:
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Your descriptive commit message"

# Push to trigger deployment
git push
```

### What Gets Deployed:
- All Supabase Edge Functions in `supabase/functions/`
- Netlify Edge Functions in `netlify/edge-functions/` (via Netlify)
- Static files in `web/public/` (via Netlify)

### No Manual Deployment Needed:
- ❌ No `supabase functions deploy` commands
- ❌ No manual Supabase CLI operations 
- ❌ No separate deployment scripts (they exist for local testing only)

### Verification:
- Check GitHub Actions tab for deployment status
- Function logs available in Supabase dashboard
- Changes take 1-2 minutes to propagate

---

**Key Point**: Any time you modify files and want to deploy, just `git add`, `git commit`, `git push`. GitHub Actions does the rest automatically.
</content>
</invoke>
