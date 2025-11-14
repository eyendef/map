
TRON-style Map Demo v2 — Next.js + Maplibre (Improved visuals + native beam)

How to run:
- Upload this project to StackBlitz or Replit and run `npm install` then `npm run dev`.
- The demo contains:
  - public/geojson/uz_chinaz.geojson : sample GeoJSON for Chinaz region (Tashkent district)
  - Neon map style: public/neon-style.json
  - Improved visuals: scanlines, vignette, subtle grid, layered glowing outlines.
  - Map-native animated beam implemented as an overlaid canvas driven by map projection and animation loop.
  - Interactive map with glowing polygons, click-to-open sidebar, donuts and treemap tiles, and pulsing centroid indicator.

Notes:
- The beam is implemented as a canvas overlay that uses map.project(...) to convert geo coords to screen coords and draws an additive, glowing line.
- To use real data, replace public/geojson/uz_chinaz.geojson with your GeoJSON. Each feature should have properties:
  - name, region, flood_projects, president_votes (object), vice_votes (object), senatorial (array)
- If you want a fully WebGL shader-based beam (drawn directly in map GL context) I can implement a custom Maplibre 'custom' layer that uses WebGL. This canvas implementation is widely compatible and still looks GPU-accelerated and smooth.
