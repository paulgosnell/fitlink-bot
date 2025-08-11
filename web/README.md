# 🌐 Fitlink Bot Web Dashboard

## Hosting Options

### Option 1: Supabase Storage (Recommended)
```bash
# Upload to Supabase Storage bucket
supabase storage cp ./web/public/* supabase://your-bucket/

# Enable public access
supabase storage update your-bucket --public
```

### Option 2: Vercel (Free)
```bash
cd web
npx vercel --prod
```

### Option 3: Netlify (Free)
```bash
cd web
npx netlify deploy --prod --dir=public
```

### Option 4: GitHub Pages
1. Push to GitHub
2. Go to Settings > Pages
3. Select source: `web/public` folder

## Static Files Only
- No server-side rendering needed
- All functionality runs on Supabase Edge Functions
- Just hosts the landing page and documentation

## Features
- Responsive design with Tailwind CSS
- Direct links to Telegram bot
- Feature showcase
- Sample conversation
- GitHub integration

The web dashboard is purely informational - all bot functionality runs serverlessly on Supabase!
