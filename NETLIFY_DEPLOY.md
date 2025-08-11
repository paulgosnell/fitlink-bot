# 🚀 Deploy Fitlink Bot Web Dashboard to Netlify

## Quick Deploy Options

### Option 1: GitHub Auto-Deploy (Recommended)
1. **Connect Repository**:
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "New site from Git"
   - Connect your GitHub account
   - Select `paulgosnell/fitlink-bot` repository

2. **Configure Build Settings**:
   ```
   Build command: echo "Static site - no build needed"
   Publish directory: web/public
   ```

3. **Deploy**:
   - Click "Deploy site"
   - Netlify will auto-deploy on every push to main branch

### Option 2: Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy from project root
netlify init
netlify deploy --prod --dir=web/public
```

### Option 3: Manual Upload
1. Build a zip of `web/public/` folder
2. Drag & drop to Netlify dashboard
3. Instant deployment

## Custom Domain Setup

### Step 1: Add Domain in Netlify
1. Go to Site Settings > Domain management
2. Click "Add custom domain"
3. Enter your domain (e.g., `fitlinkbot.com`)

### Step 2: Configure DNS
Add these records to your domain provider:

**For Apex Domain (fitlinkbot.com):**
```
Type: A
Name: @
Value: 75.2.60.5
```

**For Subdomain (www.fitlinkbot.com):**
```
Type: CNAME
Name: www
Value: your-site-name.netlify.app
```

### Step 3: Enable HTTPS
- Netlify auto-provisions SSL certificates
- Force HTTPS redirect in Site Settings

## Environment Variables (Optional)

If you add dynamic features later:
```bash
# Set via Netlify CLI
netlify env:set TELEGRAM_BOT_USERNAME "the_fitlink_bot"
netlify env:set GITHUB_REPO "paulgosnell/fitlink-bot"
```

## Performance Optimization

### Included Optimizations:
- ✅ CDN distribution (global edge locations)
- ✅ Asset compression (gzip/brotli)
- ✅ Cache headers for static assets
- ✅ Security headers (CSP, HSTS, etc.)
- ✅ Preload hints for critical resources

### Monitoring:
- **Netlify Analytics**: Built-in traffic insights
- **Core Web Vitals**: Automatic performance monitoring
- **Form Handling**: Ready for contact forms (if added)

## SEO Ready

### Included:
- ✅ `robots.txt` for search engine crawling
- ✅ `sitemap.xml` for better indexing
- ✅ Open Graph meta tags (in HTML)
- ✅ Responsive design for mobile
- ✅ Fast loading times

### Update These:
1. Replace `your-domain.com` in `robots.txt` and `sitemap.xml`
2. Update social media links in footer
3. Add Google Analytics (optional)

## Auto-Deploy Workflow

```
GitHub Push → Netlify Build → Deploy → CDN Cache Invalidation
```

**Deploy time**: ~30 seconds
**Global propagation**: ~1 minute

## Branch Previews

Netlify automatically creates preview deployments for:
- Pull requests
- Feature branches
- Development branches

Perfect for testing before merging!

## Monitoring & Analytics

### Built-in Netlify Analytics:
- Page views and unique visitors
- Top pages and referrers  
- Geographic distribution
- Performance metrics

### Optional Integrations:
- Google Analytics 4
- Hotjar for user behavior
- Sentry for error tracking

## Custom 404 Page (Optional)

Create `web/public/404.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found - Fitlink Bot</title>
    <meta http-equiv="refresh" content="3;url=/">
</head>
<body>
    <h1>Oops! Page not found</h1>
    <p>Redirecting to home page...</p>
</body>
</html>
```

## Cost

- **Hobby Plan**: Free (100GB bandwidth, 300 build minutes)
- **Pro Plan**: $19/month (400GB bandwidth, 1000 build minutes)
- **Business Plan**: $99/month (1TB bandwidth, 2500 build minutes)

Your static site will likely stay within free tier limits!

## Final Checklist

- [ ] Repository connected to Netlify
- [ ] Custom domain configured
- [ ] HTTPS enabled and forced
- [ ] DNS records pointing to Netlify
- [ ] Site loads at your custom domain
- [ ] All links work correctly
- [ ] Mobile responsive design verified
- [ ] Performance score > 90 (use PageSpeed Insights)

🎉 **Your Fitlink Bot web dashboard is now live!**
