# lift-drag-thrust-grav

A crisp 2D flight runner prototype (PixiJS + planck.js) designed for static hosting on S3 + CloudFront.

## Project layout
```
assets/             # art, fonts, sfx (source files)
public/             # deployable static site (MVP lives here)
  index.html
  app.js
  styles.css
docs/
  design.md         # design & architecture outline
```

## Quickstart (local)
- Open `public/index.html` directly in a browser, or
- Serve the folder with a static server to match S3 behavior:

```bash
# Python 3
python -m http.server -d public 8080
# Node (one-off)
npx serve public -l 8080 --single
```
Then visit `http://localhost:8080`.

## Deploy to AWS S3 (+ CloudFront)
Prereqs:
- AWS CLI configured (`aws configure`)
- An S3 bucket for the site (name in examples: `$BUCKET`)
- Optional: CloudFront distribution ID (`$DISTRIBUTION_ID`)

1) Create bucket (skip if it exists)
```bash
aws s3 mb s3://$BUCKET
```

2) Enable static website hosting (if serving via S3 website endpoint)
```bash
aws s3 website s3://$BUCKET/ --index-document index.html --error-document index.html
```

3) Upload site (cache-bust everything, but keep index.html no-store)
```bash
# Upload all except index.html with long cache
aws s3 sync public/ s3://$BUCKET/ \
  --delete \
  --exclude index.html \
  --cache-control max-age=31536000,public

# Upload index.html with no-store so updates are instant
aws s3 cp public/index.html s3://$BUCKET/index.html \
  --cache-control no-store
```

4) If using CloudFront, invalidate cache
```bash
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

Notes:
- If your CloudFront origin is the S3 bucket (not the website endpoint), keep the bucket private and use Origin Access Control (OAC).
- Map your domain in Route 53 to the CloudFront distribution; set the default root object to `index.html`.

## What’s next
- Flesh out `src/` and wire planck.js with a fixed timestep.
- Add a debug overlay for forces and contact sensors.
- Build a minimal economy loop (distance → coins → upgrades).

## License
MIT