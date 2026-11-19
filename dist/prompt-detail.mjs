import photo from './photographic-v2.0.mjs';

export const detailLevels = Object.freeze({
  compact: 'Compact',
  standard: 'Standard',
  full: 'Full Master'
});

export const defaultDetailLevel = 'standard';

// Output renditions only. Full Master uses the canonical module directly.
const standard = `PHOTOGRAPHIC REALISM & CINEMATIC ART DIRECTION — v2.0

PHYSICAL PHOTOGRAPHIC AUTHENTICITY:

Create a premium fine-art architectural and environmental editorial photograph with real-world photographic authenticity and cinematic sophistication. Maintain believable architecture, spatial relationships, perspective, optics, and depth. Render tactile natural materials with subtle imperfections and credible responses to direct and indirect light, with controlled reflections and natural detail. Avoid CGI, illustration, and artificial architectural rendering.

ARTISTIC LIGHTING & VISUAL HIERARCHY:

Shape physically plausible light to give the scene dimensionality, visual hierarchy, and emotional atmosphere. Use naturally varied brightness, gentle light-to-shade transitions, and subtle directional light where appropriate. Balance luminance to guide attention toward the architecture and surrounding environment, while allowing secondary areas to recede without obscuring essential details. Avoid flat, uniform illumination.

PRESERVE CINEMATIC TONAL DEPTH:

Use rich, nuanced midtones, softly controlled highlights with delicate roll-off, and deep but detailed shadows. Keep tonal gradients and shadow transitions smooth. Use selective local contrast to reveal important forms, textures, and depth without artificial clarity.

PROFESSIONAL COLOR GRADING:

Apply refined cinematic-editorial grading in service of the specified palette, time, weather, lighting, and emotion. Balance highlights, midtones, and shadows with refined color separation and controlled saturation. Subtly idealize the scene without artificial recoloring. Adapt to bright, muted, pastel, warm, cool, misty, and low-light scenes without imposing a universal dark, desaturated, teal-and-orange, or blue-toned look.

ATMOSPHERIC & EMOTIONAL DEPTH:

Build an immersive sense of place through intentional relationships between foreground, architecture, and background. Where appropriate, use environmental atmosphere, natural light diffusion, and distance-based tonal separation. Preserve authentic detail while shaping a cohesive, evocative scene that feels carefully observed and timed.

FINAL PHOTOGRAPHIC CHARACTER:

Avoid generic real-estate imagery, unedited snapshots, flat exposure, excessive HDR, oversaturation, crushed blacks, artificial sharpening, plastic textures, exaggerated bloom, and visibly synthetic cinematic effects.`;

const compact = `PHOTOGRAPHIC REALISM & CINEMATIC ART DIRECTION — v2.0

Create a premium, evocative fine-art editorial photograph. Keep architecture, perspective, optics, scale, and depth believable, with tactile imperfect materials, natural detail, credible direct and indirect light, and controlled reflections.

Shape plausible, varied light to lead attention to the architecture and environment. Let secondary areas recede without losing essential detail. Preserve nuanced midtones, gentle highlight roll-off, detailed deep shadows, smooth transitions, and selective local contrast. Use foreground-to-background layering, natural diffusion, and distance-based tonal separation where appropriate.

Grade for the chosen palette, time, weather, and mood, with balanced tones, refined color separation, and controlled saturation. Avoid artificial recoloring or a fixed dark, desaturated, teal-and-orange, or blue grade. Avoid CGI, illustration, render aesthetics, real-estate or snapshot styling, flat exposure, excessive HDR, oversaturation, crushed blacks, artificial sharpening, plastic textures, exaggerated bloom, and synthetic effects.`;

export function renderPhoto(level) {
  switch (level) {
    case 'full': return photo.text;
    case 'compact': return compact;
    default: return standard;
  }
}
