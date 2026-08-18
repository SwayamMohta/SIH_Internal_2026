# Project Rules

## Animation & Visual Standards
- **Zero Unsolicited Overlays**: Never add random text, badges, HUDs, or overlays on animation / canvas screens unless explicitly requested by the user. Keep animation screens purely visual and clean.
- **Strict Scope**: Only add UI elements explicitly requested. Do not add arbitrary text boxes, progress chips, or decorative overlays over visual animations.
- **Visual Integrity**: Ensure 3D objects, meshes, ribbons, and trajectories do not awkwardly collide or overlap.
- **TypeScript Integrity**: Always verify `npx tsc --noEmit` passes with 0 errors.
