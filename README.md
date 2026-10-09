# BREAKLINE ’99 — Version 4.0

A playable 3D surf arcade made with **vanilla JavaScript, Three.js and Vite**. Ride Sunset Point or explore **The Waterworks**, a sunken sewage basin beneath an abandoned factory. Four surfers, twelve outfits, a board workshop and eight aerial tricks share the same two-minute score chase. Both modes use a **surfboard**.

Faceted water, proportioned low-poly characters, baked cloth and face shading, chunky gold scores, dithering and a 640-pixel retro view give the game a late-1990s console feel. The models, deck artwork and mellow surf instrumental are original and generated in code. A closer chase camera keeps the rider and board clearly visible.

## Play in StackBlitz

To play immediately without installation, open the included **`Play-Breakline-99.html`** in a modern browser. It bundles the complete game and works offline. Use the source project below when you want to edit the game.

**Quick launch:** extract `breakline-99.zip`, open `Launch-StackBlitz.html` in your browser and click **OPEN IN STACKBLITZ**. The launcher contains the source and uses the official StackBlitz SDK to create a Vite project. Open its preview, choose a mode and click **DROP IN**.

**Updating an older copy:** use the launcher from this version, or replace the files in your existing StackBlitz project with this version’s contents. An already-open project does not update when a new ZIP is downloaded. Import the complete `src/` and `tests/` folders, including the new `src/special.js` and `src/waterworks.js`, and replace matching files.

If the launcher is blocked, import manually:

1. Open [a new Vite JavaScript project](https://vite.new/vanilla).
2. Drag the **contents** of the extracted `breakline-99` folder into StackBlitz’s Files panel and replace matching starter files. Keep `package.json`, `index.html`, `src/` and `tests/` at the project root.
3. In its terminal, run:

   ```sh
   npm install
   npm run dev
   ```

4. Open the preview in a new tab for the largest view and reliable keyboard focus.

StackBlitz normally starts the `dev` script automatically; do not start another server if one is already running. The launcher and dependency installation need an internet connection. The game needs WebGL 2 and hardware acceleration.

Official guides: [import projects](https://developer.stackblitz.com/guides/user-guide/importing-projects) · [create with the SDK](https://developer.stackblitz.com/guides/integration/create-with-sdk).

## Choose your session

| Mode | How to ride | Third challenge |
| --- | --- | --- |
| **Surf Session — Sunset Point** | Carve an endless wave, pop from its left lip, catch sun rings and avoid reef rocks. | Catch 6 sun rings. |
| **The Waterworks — Lower Sewage Works** | Steer through a 240 × 360 metre sunken factory basin, with 18 ramps/banks, 2 hollow rust tunnels and 10 grind lines. Wave lips launch you automatically; quarter pipes turn you back into the park. | Ride 5 different ramps. |

Both modes also challenge you to score **5,000 points** and bank **one 1,500-point combo**. Each mode has its own personal best. Use **MAIN MENU** to change modes or customise your rider.

The Waterworks has **three connected drainage channels, a collection bowl and two halfpipes**, perimeter spillways, three spines, three kickers, two raised glide decks and two pipe-access ramps. Tall retaining walls, upper factory floors, catwalks, broken roofs, structural columns and leaking outfalls surround the riding area.

Both abandoned rust pipes have **open ends, curved rideable interiors and grind rails along their crests**. Their sides and ceilings are solid. Use the side access ramps to reach their roofs. Rail bodies and supports also collide with the rider; jump onto the top along the rail's length to grind, then press Space to pop off.

Choose **South Canal, West Rust Tunnel, East Rust Tunnel or Filter Halfpipe** in the home menu's **DROP POINT** selector. This changes where your next run starts. The plant plan marks your position with a yellow arrow, tunnels in orange and grind routes in cream.

The ground is one static surface shared with the physics layout. Ground textures stay fixed, distant textures use mipmaps, and animated water is confined to discharge streams and foam. This removes the moving floor colours, overlapping surface flicker and floor vertex jitter from the earlier version.

## Make it yours

Open **SELECT SURFER** for Kai, Nova, Reef or **Jax**, a standing 3D character preview, a biography and style ratings. The reworked bodies have natural shoulder and waist proportions, loose clothing, painted face details and jointed arms and legs. Ratings and stance labels describe their style; all four share the same movement physics.

All four can wear any of the **twelve outfits**, including oversized surf tees, an open tropical shirt, beachwear with a straw hat, a wetsuit and a long-sleeve rashguard. Jax starts in **Yard Crew**: a grey sweatshirt, baggy grey trousers, a backwards white cap, long dreadlocks and trainers. **Sun Crew** adds the yellow sweatshirt and navy trousers alternative.

Open **CUSTOMISE BOARD** to combine **five deck colours** with **eight original graphics**: Lightning, Checker Rip, Hot Rod, Black Tide, Hibiscus, Skull Reef, Solar Flare and Pinstripe. Your choices appear on the surfboard in both modes.

The selected character, outfit, board, mode, sound preference and personal bests save automatically in the current browser when local storage is available. They are not synced between devices or different preview addresses.

## Controls

| Key | Action |
| --- | --- |
| A / D or Left / Right | Carve across the wave; steer left / right in the park. |
| W / Up | Pump for speed. |
| S / Down | Slow down. |
| Space | Hold to charge, then release to pop. Tap for a quick jump or to pop off a water rail. |
| J | 180 spin while airborne. |
| K | Kickflip while airborne. |
| L | Indy grab while airborne. |
| U | Shuv-it: spin the board beneath the rider. |
| O | Heelflip while airborne. |
| H | Method Air while airborne. |
| F | 360 Air while airborne. |
| I | Rodeo Air while airborne when the **SPECIAL** meter is full. |
| Enter | Bank a landed combo; start or replay from the menu/results. |
| P / Escape | Pause / resume. Escape also closes customisation. |
| R | Restart the current session. |
| M | Toggle music and effects. |

The **? Controls** panel pauses an active session. Touch controls include steering, pump, slow, pop, all eight tricks and bank; enable them in Controls if needed. Losing focus or hiding the tab pauses an active run and clears held controls.

## Build a combo

- Hold Space, release, press K, wait for the flip to finish, then land and press Enter. Try adding J on a higher jump.
- Finish each trick before landing. One trick plays at a time. Each completed trick increases the multiplier, up to **×8**; repeated moves lose value within a combo.
- After landing, pop again within **3.8 seconds** to continue the combo. Enter banks it immediately; letting the combo meter expire also banks it. A wipeout loses the active combo.
- Completed tricks and banked points fill **SPECIAL**. Once it reaches **100%**, it stays ready through waiting and wipeouts until you use it. Press I during an air to spend the charge on Rodeo Air, and leave enough airtime to finish it. Restarting or returning to the main menu resets the meter. A partly filled meter slowly drains and loses charge on a wipeout.
- In Surf Session, sun rings award **250 points** and strong carving earns extra style points. In The Waterworks, launch from different ramps and jump onto a water rail **along its length** to slide. Pop off or ride off its end before landing and banking.
- A grounded combo banks at the final buzzer. An airborne combo or active rail slide is forfeited. The result screen shows your score, rank and completed challenges.

## Sound and video

**“Riptide Radio ’99”** is an original, mellow **64-bar instrumental at 108 BPM**, lasting about 2 minutes 22 seconds before it loops. Clean plucked-string guitar plays spacious melodies over warm bass, soft brushed drums and shaker. Seventh/add-nine chords, stereo chorus, slapback and reverb give it a relaxed coastal sound. The Waterworks adds a little extra percussion. Web Audio generates every note and effect; no music download is needed.

Sound starts after **DROP IN**, unless you previously switched it off. Use **SOUND** or M to toggle it. Music continues in the home menu after being enabled and stops while gameplay is paused.

The **PIXELS / VIDEO** button switches between the 640-pixel retro view and a cleaner resolution. Both retain the low-poly models and textures.

## Run locally

Use Node.js **20.19+** or **22.12+** for Vite 7, then run:

```sh
npm install
npm run dev
```

Open the address shown in the terminal, usually `http://localhost:5173`.

```sh
npm test          # Surf, park, scoring and SPECIAL checks
npm run build    # Production bundle in dist/
npm run preview  # Preview that production build
```

After installation, the game has no network dependency: models, textures, music and fonts are local or generated. The game itself uses no account or server.

## Source map

| File | Purpose |
| --- | --- |
| `index.html`, `src/style.css` | Home page, menus, HUD and responsive layout. |
| `src/main.js` | Controls, session switching, fixed-step loop, special meter and saved choices. |
| `src/game.js` | Surf simulation, tricks, combos and scoring. |
| `src/park.js` | The Waterworks layout, ramp physics, rail slides and bounds. |
| `src/park-camera.js` | Keeps the camera view clear of ramp backs and perimeter walls. |
| `src/park-map.js`, `src/factory.css` | Live factory plan marking the rider, tunnels and grind routes. |
| `src/selection.css` | Retro character selection and board workshop layout. |
| `src/special.js` | SPECIAL charging, full-charge latch and consumption. |
| `src/world.js` | Three.js scenes, faceted ocean, park graphics and camera. |
| `src/waterworks.js` | Factory architecture, wave ramps, rails and park scenery. |
| `src/appearance.js` | Jointed characters, poses, outfits, board artwork and standing preview. |
| `src/audio.js` | Original mellow surf instrumental and effects. |
| `tests/` | Surf, park and SPECIAL regression checks. |

To tune the game, edit `RUN_SECONDS` or `TRICKS` in `game.js`, the ramp definitions in `park.js`, or outfit/board choices in `appearance.js`. Keep the ocean shader in `world.js` aligned with `waveHeight()` in `game.js` when changing the wave shape.

## Licence

Original project source is MIT licensed; see `LICENSE`. Dependencies retain their own licences. This independent project is not affiliated with Tony Hawk, Activision or Neversoft and includes no proprietary characters, logos, levels, recordings or artwork from their games.
