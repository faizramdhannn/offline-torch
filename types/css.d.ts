// Ambient declaration so TypeScript doesn't complain about side-effect CSS
// imports from third-party packages (e.g. "leaflet/dist/leaflet.css").
// Next.js only ships types for *.module.css out of the box.
declare module "*.css";