# Extension Icons

Replace these placeholder icon files with your actual icon designs.

## Required Sizes

- `icon-16.png`: 16x16px (toolbar icon)
- `icon-48.png`: 48x48px (extension management)
- `icon-128.png`: 128x128px (Chrome Web Store)

## Design Guidelines

- Use a simple, recognizable symbol
- Ensure icons work on light and dark backgrounds
- Follow browser extension icon guidelines
- Consider accessibility (sufficient contrast)

## Generating Icons

You can use tools like:
- Figma
- Sketch
- Adobe Illustrator
- Online generators (realfavicongenerator.net)

Or generate programmatically:

```bash
# Using ImageMagick
convert -size 128x128 xc:blue -fill white -pointsize 72 -gravity center \
  -annotate +0+0 "M" icon-128.png

convert icon-128.png -resize 48x48 icon-48.png
convert icon-128.png -resize 16x16 icon-16.png
```
