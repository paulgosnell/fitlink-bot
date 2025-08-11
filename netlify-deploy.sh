#!/bin/bash

echo "🚀 Deploying Fitlink Bot to Netlify..."

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

echo "🔐 Please login to Netlify if not already logged in..."
netlify status || netlify login

echo "🏗️  Deploying to production..."
netlify deploy --prod --dir=web/public

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your site should be live at:"
netlify status | grep "Website URL"
echo ""
echo "📋 Next steps:"
echo "1. Set up custom domain in Netlify dashboard"
echo "2. Update robots.txt and sitemap.xml with your domain"
echo "3. Configure DNS records with your domain provider"
echo "4. Enable analytics in Netlify (optional)"
