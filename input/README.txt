=== PRODUCT VIDEO INPUT FOLDER ===

Drop product photo folders here. Each folder = one product.

Folder naming:
  "Amazing Widget"     -> product name: Amazing Widget, slug: amazing-widget
  "cool-headphones"    -> product name: Cool Headphones, slug: cool-headphones

Inside each folder, put:
  - Product images (.jpg, .png, .webp)
  - Optional: config.json for custom text/colors/template

Images are auto-sorted by filename. Name them like:
  01-hero.jpg          (first image = hero/package shot)
  02-detail.jpg        
  03-feature.jpg       
  ...or just drop them in any order — they'll sort alphabetically.

Optional config.json:
{
  "productName": "My Product",
  "tagline": "Best product ever",
  "hookText": "Tired of bad products?",
  "features": ["Premium quality", "Fast shipping", "Top rated"],
  "proofNumber": 50000,
  "proofLabel": "happy customers",
  "ctaText": "Link in bio",
  "hashtags": ["trending", "viral", "musthave"],
  "colors": { "primary": "#d97706", "accent": "#f59e0b" },
  "templates": ["product-demo", "unboxing"],
  "bgStyle": "dark",
  "bgPhotoCount": 3,
  "bgVideoCount": 1,
  "fetchBackgrounds": true
}

All fields are optional — anything missing gets smart defaults.

Pexels Backgrounds:
  bgStyle       "dark" | "light" | "abstract" | "lifestyle" (default: dark)
  bgPhotoCount  Number of stock photos to fetch (default: 3)
  bgVideoCount  Number of stock videos to fetch (default: 1)
  fetchBackgrounds  Set to false to skip Pexels entirely

Backgrounds auto-apply to Hook, Features, and CTA scenes in all templates.
