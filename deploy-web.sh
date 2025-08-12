#!/bin/bash

echo "🌐 Deploying Fitlink Bot Web Dashboard..."

# Option 1: Deploy to Vercel (requires vercel CLI)
if command -v vercel &> /dev/null; then
    echo "📦 Deploying to Vercel..."
    cd web && vercel --prod
    echo "✅ Deployed to Vercel!"
    exit 0
fi

# Option 2: Deploy to Netlify (requires netlify CLI)
if command -v netlify &> /dev/null; then
    echo "📦 Deploying to Netlify..."
    cd web && netlify deploy --prod --dir=public
    echo "✅ Deployed to Netlify!"
    exit 0
fi

# Option 3: Instructions for manual deployment
echo "📋 Manual deployment options:"
echo ""
echo "🔹 Vercel:"
echo "   npm i -g vercel"
echo "   cd web && vercel --prod"
echo ""
echo "🔹 Netlify:"
echo "   npm i -g netlify-cli"  
echo "   cd web && netlify deploy --prod --dir=public"
echo ""
echo "🔹 GitHub Pages:"
echo "   1. Push to GitHub"
echo "   2. Go to Settings > Pages"
echo "   3. Select source: web/public folder"
echo ""
echo "🔹 Any static host:"
echo "   Upload contents of web/public/ folder"
