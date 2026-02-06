export const SAMPLE_PROMPTS: string[] = [
  // Landscapes
  'A serene Japanese garden at dawn with cherry blossoms falling over a koi pond, soft morning light filtering through maple trees, photorealistic',
  'Dramatic aerial view of Norwegian fjords during golden hour, turquoise water reflecting snow-capped mountains, cinematic photography',
  'Enchanted forest with bioluminescent mushrooms and fireflies, misty atmosphere, magical realism, detailed foliage',
  'Vast desert landscape with towering sand dunes under a star-filled Milky Way sky, long exposure photography style',
  'Tropical waterfall cascading into a crystal-clear lagoon surrounded by lush rainforest, volumetric light rays, hyperrealistic',

  // Portraits
  'Portrait of an elderly fisherman with weathered skin and kind eyes, dramatic side lighting, black and white photography, Hasselblad quality',
  'Ethereal portrait of a woman with flowers growing from her hair, soft bokeh background, fine art photography, pastel colors',
  'Cyberpunk street samurai with neon reflections on chrome armor, rain-soaked alley, blade runner aesthetic, highly detailed',
  'Renaissance-style portrait of a young scholar reading by candlelight, oil painting technique, Rembrandt lighting, rich warm tones',
  'Portrait of a tribal warrior with intricate face paint and ceremonial headdress, golden hour backlight, National Geographic style',

  // Sci-Fi
  'Massive space station orbiting a gas giant with rings, small shuttles approaching docking bays, hard sci-fi concept art, Greg Rutkowski style',
  'Abandoned alien megastructure on a desert planet, massive scale with tiny human explorers for reference, matte painting style',
  'Futuristic city on Mars with glass domes and terraformed gardens, red dust storms in the background, architectural visualization',
  'Interior of a generation ship with vertical farms and suspended walkways, warm artificial lighting, sci-fi concept art',
  'First contact scene with an enormous alien vessel hovering over a calm ocean, dramatic clouds, cinematic wide shot',

  // Fantasy
  'Ancient dragon perched atop a crumbling gothic cathedral during a thunderstorm, lightning illuminating its scales, dark fantasy art',
  'Floating islands connected by rope bridges above a sea of clouds, waterfalls cascading into the void, Studio Ghibli inspired',
  'Mystical library inside a giant hollow tree, shelves carved into bark, glowing runes on ancient books, warm candlelight',
  'Crystal cave kingdom with dwarf-forged architecture, gemstone stalactites reflecting torchlight, detailed fantasy illustration',
  'Elven city built into the canopy of enormous redwood trees, golden sunlight filtering through leaves, Lord of the Rings aesthetic',

  // Architecture
  'Brutalist concrete apartment complex overgrown with vines and wildflowers, post-apocalyptic solarpunk aesthetic, golden hour',
  'Futuristic organic architecture inspired by coral reefs, iridescent building surfaces, parametric design, Zaha Hadid style',
  'Medieval castle on a cliff overlooking a stormy sea, dramatic waves crashing against rocks, moody atmospheric painting',
  'Art Deco skyscraper interior with geometric brass fixtures, marble floors, warm amber lighting, 1920s luxury',
  'Traditional Moroccan riad courtyard with intricate zellige tilework, a central fountain, and orange trees, bright midday sun',

  // Food
  'Artisan sourdough bread fresh from the oven, steam rising, rustic wooden table, natural window light, food photography',
  'Japanese kaiseki course plated on handmade ceramic, minimalist presentation, overhead shot, Michelin star quality',
  'Colorful Mexican street food spread with tacos, salsas, and grilled corn, vibrant market backdrop, warm tones',

  // Animals
  'Snow leopard stalking through a Himalayan blizzard, intense gaze, frost on whiskers, wildlife photography, telephoto lens',
  'Octopus in a coral reef changing colors, bioluminescent deep sea backdrop, underwater photography, macro detail',
  'Pack of wolves howling on a moonlit snowy ridge, northern lights in the sky, cinematic composition',
  'Hummingbird frozen mid-flight drinking from a tropical flower, iridescent feathers, high-speed photography, bokeh background',

  // Abstract & Artistic
  'Explosive collision of liquid gold and deep blue paint in zero gravity, high-speed photography, black background',
  'Fractal mandala made of living coral and sea glass, sacred geometry, vibrant turquoise and coral palette, digital art',
  'Surrealist landscape where clocks melt over impossible staircases, Escher meets Dali, dreamlike atmosphere',
  'Geometric abstract composition with translucent overlapping shapes, gradient from warm to cool tones, minimalist design',

  // Macro
  'Extreme macro of a dragonfly eye covered in morning dew drops, each droplet reflecting the landscape, focus stacking',
  'Frost crystals forming intricate patterns on a window pane at sunrise, backlit with warm golden light, macro photography',
  'Cross-section of a geode revealing amethyst crystals, studio lighting highlighting purple translucency, product photography',

  // Underwater
  'Sunken ancient Greek temple covered in coral with schools of tropical fish swimming through marble columns, underwater photography',
  'Massive blue whale gliding through sunlit ocean depths, light rays piercing the surface above, cinematic underwater shot',

  // Space
  'Astronaut floating above Earth during sunrise, visor reflecting the curvature of the planet, photorealistic, IMAX quality',
  'Nebula nursery with newborn stars, Hubble telescope style, vivid cosmic colors, deep space photography',
  'Lunar base at twilight with Earth rising over the horizon, retro-futuristic architecture, 1970s NASA concept art style',

  // Cyberpunk
  'Rain-drenched cyberpunk Tokyo alley with holographic advertisements and noodle stands, neon reflections on wet pavement, blade runner mood',
  'Underground hacker den with walls of monitors showing green code, scattered energy drinks, moody blue and purple lighting',

  // Steampunk
  'Victorian steampunk airship docking at a clocktower port above the clouds, brass and copper details, warm sunset lighting',
  'Steampunk inventor workshop filled with gears, brass instruments, and bubbling beakers, warm gas lamp lighting, detailed illustration',

  // Misc
  'Cozy cabin interior during a snowstorm, fireplace crackling, bookshelves lining the walls, a cat sleeping on a knitted blanket, hygge aesthetic',
  'Vintage 1960s space race propaganda poster style illustration of astronauts planting a flag on the moon, bold colors, retro typography',
];

let lastIndex = -1;

export function getRandomPrompt(): string {
  if (SAMPLE_PROMPTS.length <= 1) {
    return SAMPLE_PROMPTS[0] ?? '';
  }

  let index: number;
  do {
    index = Math.floor(Math.random() * SAMPLE_PROMPTS.length);
  } while (index === lastIndex);

  lastIndex = index;
  return SAMPLE_PROMPTS[index];
}
