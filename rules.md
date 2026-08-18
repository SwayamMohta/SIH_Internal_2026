# PROJECT RULES & MANDATES

> **CRITICAL DIRECTIVE**: The agent must follow all rules defined in this document without exception across all sessions and tasks.

---

### Rule 1: Zero Unsolicited Overlays / Text on Animation Screens
- **NEVER** add random text, status banners, HUD boxes, badges, floating cards, or progress indicators on top of the 3D canvas / animation screen unless the user explicitly and directly asks for them.
- Keep animation screens 100% pure, cinematic, and uncluttered.
- Do not inject placeholder badges, fake status chips (e.g. "Audio Active", "Press in motion"), or unnecessary buttons onto full-screen visual scenes.

---

### Rule 2: Strict Adherence to User Instructions & Minimal Surface Area
- Only implement and display elements that the user specifically requests.
- Do not add extra widgets, decorative text blocks, or speculative features that clutter the interface.
- If the user asks to remove elements or make a scene pure/clean, remove all extraneous elements immediately.

---

### Rule 3: Visual & Spatial Integrity in 3D Scenes
- Ensure all 3D ribbons, rolls, and geometry have distinct coordinates and trajectories.
- Verify that elements do not collide, intersect clumsily, or overlap undesirably.
- Preserve smooth camera movement, high FPS, and clean lighting.

---

### Rule 4: Clean Architecture & Error-Free Code
- All code must pass TypeScript compilation (`tsc --noEmit`) with zero errors.
- Ensure proper cleanup of Three.js resources (geometries, materials, textures, requestAnimationFrame loops) when components unmount or transitions occur.
- Keep state management clean and predictable.
