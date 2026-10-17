#!/usr/bin/env bash
# Push commit len fork va deploy production len Vercel
set -e
cd "$(dirname "$0")"
git push origin master
vercel deploy --prod
