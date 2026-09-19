# LOWTOWN Visual Reference: Uploaded Video

## Source
- File: MiniMaxH300124.mp4
- Resolution: 640x640
- Frame rate: 24 fps
- Frame count: 124
- Duration: ~5.17 s
- Sampling used for analysis: 12 frames distributed across the clip

## What the reference actually establishes

The clip is a cinematic, photorealistic road shot rather than an isometric game view. Its strongest transferable properties are camera language, lighting, materials, color separation, motion treatment and environmental density.

### Camera
- Low road-level follow/chase camera.
- Main subject remains close to the horizontal center.
- Road perspective creates a strong vanishing point ahead of the vehicle.
- Camera is aligned with the road rather than looking from a fixed overhead/isometric angle.
- The road occupies most of the lower frame, creating a strong sense of forward motion.
- Subject scale changes smoothly as the camera/vehicle relationship changes.

### Environment
- Curving two-lane asphalt road.
- Dense trees form a corridor on both sides.
- Background is intentionally soft and atmospheric.
- Road markings are strong graphic guides: double yellow center lines and bright edge lines.
- Wet asphalt is a major visual element, not just a surface texture.
- Fallen leaves provide foreground and midground detail.

### Lighting and palette
- Dominant warm orange/amber foliage.
- Cool neutral gray overcast sky.
- Very dark gray/black wet asphalt.
- Bright warm road markings.
- High local contrast around the vehicle and road surface.
- Reflections mirror the warm environment on the dark road.

### Motion
- Forward movement is communicated through road flow and longitudinal motion blur.
- Foreground blur is stronger than distant background blur.
- The subject stays comparatively readable while the environment moves around it.
- The visual effect should feel like speed, not camera shake.

### Material language
- Wet asphalt: glossy, dark, reflective.
- Painted road lines: bright, clean and reflective.
- Vegetation: saturated warm leaves with layered depth.
- Vehicle/object: high-detail hard surface with readable edges and specular highlights.
- Water/reflection layer should be integrated into the road rather than added as an isolated effect.

## Translation into LOWTOWN

The reference should be treated as a **visual target**, not copied literally.

### Keep
1. Strong forward perspective.
2. Wet reflective surfaces.
3. Warm/cool lighting contrast.
4. Dense environmental framing.
5. Cinematic depth and motion.
6. Clear subject silhouette.
7. Road markings as navigation/composition elements.
8. Reflections and subtle motion blur.

### Adapt for the game
- Replace the road-only composition with a navigable city environment.
- Preserve a readable vehicle silhouette and heading.
- Keep camera motion smooth and tied to vehicle velocity.
- Use layered 2.5D/3D depth so foreground, road and background separate naturally.
- Avoid excessive bloom, chromatic aberration or artificial neon.
- Prioritize gameplay readability over photorealistic detail.

## Camera prototype target

The first playable camera should support:
- Third-person chase position behind and slightly above the vehicle.
- Smooth position interpolation.
- Smooth heading interpolation.
- Look-ahead point on the vehicle's current travel direction.
- Reduced camera rotation when the vehicle is stationary.
- Speed-dependent environmental motion blur, with a conservative maximum.

The camera must follow the **actual vehicle heading**, not the steering input alone. This directly addresses the previous LOWTOWN control problem where the vehicle could visually travel sideways before turning.

## Road and lighting prototype target

Use these as starting parameters, subject to gameplay testing:
- Asphalt base: near-black charcoal.
- Wetness: medium/high.
- Reflection strength: medium.
- Road-line brightness: high enough to remain readable at speed.
- Ambient sky: neutral gray.
- Key/environment light: warm amber/orange.
- Fog/atmosphere: subtle.
- Bloom: low.
- Motion blur: low to medium and velocity-driven.

## Visual hierarchy

At gameplay distance, the player should read the scene in this order:

1. Vehicle position and heading.
2. Drivable road/corridor.
3. Immediate obstacles and traffic.
4. Road boundaries and intersections.
5. Buildings/vegetation/environment.
6. Reflections and atmospheric detail.

## Important observation

The source clip contains generative-image/video artifacts and an intentionally surreal central object. Those artifacts are **not** part of the LOWTOWN technical target. The useful reference is the cinematography and rendering language: wet road + warm environment + cool sky + strong perspective + readable moving subject + atmospheric depth.

## Implementation direction

This branch should first establish a small vertical slice using the reference language:

**road -> vehicle -> chase camera -> wet material -> warm/cool lighting -> motion -> environment**

Only after that should we scale the same rendering language into the full city.

