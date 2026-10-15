# SafeSpace brand assets — SVG vectors

Source: SafeSpace UI/UX Implementation Kit V2 visual references. The source kit includes raster mockups, not an original vector logo; these SVGs are a faithful manually reconstructed vector approximation of the geometric teal hexagon/diamond identity, standardized across landing and application references.

Files:
- `safespace-logo.svg`: primary horizontal deep-teal mark and dark wordmark, on light backgrounds.
- `safespace-icon.svg`: standalone mark, on light backgrounds, suitable for app icon/avatar/favicon source.
- `safespace-logo-on-dark.svg`: white wordmark for dark backgrounds (dark-teal mark retained).

All shapes and letterforms are actual SVG paths/polygons, not embedded raster images and not dependent on font installation. No font files are bundled. Transparent backgrounds.

Preferred usage:
- Header: `<img src="/brand/safespace-logo.svg" alt="SafeSpace" width="175" height="36" />` (maintain aspect ratio; width can adapt)
- Standalone mark: `<img src="/brand/safespace-icon.svg" alt="SafeSpace" width="36" height="36" />`
- Place in `/public/brand/` in Next.js.
- Do not stretch, add gradients, use random shadows, or redraw the logo between screens.
