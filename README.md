# BREAKLINE ’99 — Version 8.0

A playable desktop 3D surf arcade made with **vanilla JavaScript, Three.js and Vite**. Four modes: Surf Session, The Waterworks, Reef Rush and Storm Rider. Four surfers, twelve outfits, a board workshop, nine aerial tricks and grounded cutbacks. Every mode uses a **surfboard**.

Version 8 adds **endless Storm Rider**, rideable curling barrel waves, gentler landing rules and a **B-key Tweaked Grab** inspired by the supplied aerial-pose reference. Survival ends only when all three lives are lost; the clock counts upward while speed, currents and barrel pressure increase.

Version 8 further reshapes the chest, waist and back, adds an uneven shirt hem, bent arms and an asymmetric resting stance, and rebuilds the hands and trainer soles, heels and toe boxes. Directional elbow, knee and cuff folds give the clothing more shape. The restored earlier painted faces are preserved. These bodies appear in both character selection and gameplay. `BODY-RESEARCH.md` records the reference measurements and visual checks.

The Waterworks camera follows turns smoothly, retracts around obstacles, recovers its distance gradually, and maintains stable orientation through pipe loops.

The rectangular surfwear graphic has tall black lettering over faded red, blue and yellow. It is original artwork inspired by the supplied 1990s print reference. The menu has a separate heavy guitar/breakbeat soundtrack; riding keeps the mellow surf score.

The original oval **BREAKLINE ’99 / EXTREME SURFING** badge returns in the surfer/board workshop, pause and results screens, and on the north and south Waterworks walls. The home page keeps its rectangular surfwear graphic.

Grabs now have a sustained hold. The hand follows a point on the actual board edge after the board and rider transforms, rather than reaching a fixed approximation for just one instant. The model keeps its limb lengths while crouching and gripping.

Every mode now requires **1.4 seconds of grounded recovery after landing before another manual pop**. In ocean modes, earn trick airtime by reaching the wave lip at speed or completing a **Shift + A/D cutback**. Flat-water hops and cutbacks alone give no points. The HUD shows pop recovery and the brief cutback-launch window.

## Play in StackBlitz

**Your project:** open [Breakline-2000 on StackBlitz](https://stackblitz.com/~/github.com/bobbob963/Breakline-2000). It loads the GitHub source. If a tab still shows an older version, reopen this link so StackBlitz imports the current source; the home menu should say **VOL. 08**.

To play immediately without installation, open the included **`Play-Breakline-99.html`** in a modern browser. It bundles the complete game and works offline. Use the source project below when you want to edit the game.

**Quick launch:** extract `breakline-99.zip`, open `Launch-StackBlitz.html` in your browser and click **OPEN IN STACKBLITZ**. The launcher contains the source and uses the official StackBlitz SDK to create a Vite project. Open its preview, choose a mode and click **DROP IN**.

**Updating an older copy:** use the launcher from this version, or replace the files in your existing StackBlitz project with this version’s contents. An already-open project does not update when a new ZIP is downloaded. Import the complete `src/` and `tests/` folders, including `src/storm-waves.js`, the barrel renderer, `src/rider-pose.js` and `src/session-modes.js`, plus all updated models and physics files, and replace matching files.

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

If a school or workplace filter blocks the `webcontainer.io` preview address, the project can finish loading while its game preview stays blocked. Ask the network administrator to review that address. Signing in or reimporting the project does not remove a network filter. The supplied `Play-Breakline-99.html` remains a self-contained offline copy.

Official guides: [import projects](https://developer.stackblitz.com/guides/user-guide/importing-projects) · [create with the SDK](https://developer.stackblitz.com/guides/integration/create-with-sdk).

## Choose your session

| Mode | How to ride | Third challenge |
| --- | --- | --- |
| **Surf Session — Sunset Point** | Two-minute score attack with currents, central reef obstacles and forgiving landing control. | Catch 6 sun rings. |
| **The Waterworks — Lower Sewage Works** | Steer through a 240 × 360 metre sunken factory basin, with 18 ramps/banks, 2 hollow rust tunnels and 18 grind lines. Wave lips launch you automatically; quarter pipes turn you back into the park. | Ride 5 different ramps. |
| **Reef Rush — Checkpoint Coast** | Start with 35 seconds. Each ring adds 8 seconds. Collect 12 rings to win. | Finish 12 checkpoints. |
| **Storm Rider — Squall Point** | Endless survival with 3 lives. Ride curling barrels as the current, pace and storm build over time. The timer counts upward; only losing all lives ends the run. | Ride through 3 barrels. |

All four modes also challenge you to score **5,000 points** and bank **one 1,500-point combo**. Each mode has its own best score. Storm Rider also saves your longest survival time. Use **MAIN MENU** to change modes or customise your rider.

In **Storm Rider**, the HUD shows **SURVIVED** time and a new swell stage every 30 seconds. Difficulty rises smoothly throughout the run: riding speed, current strength, rain and reduced visibility build while the barrel opening tightens. The increases stay within playable limits. Follow **BARREL AHEAD** toward the open lane, stay beneath the curling water and ride out cleanly for a bonus. The visible falling lip and roof have matching collision, so jumping into them can cost a life. The three-barrel challenge is a milestone; completing it does not end survival.

The Waterworks has **three connected drainage channels, a collection bowl and two halfpipes**, perimeter spillways, three spines, three kickers, two raised glide decks and two pipe-access ramps. Tall retaining walls, upper factory floors, catwalks, broken roofs, structural columns and leaking outfalls surround the riding area.

Both abandoned rust pipes have **open ends, curved rideable interiors and grind rails along their crests**. Their sides and ceilings are solid. Hold **E** inside a tunnel and steer with **A/D** to ride all the way around its inner wall. Release E to return safely to the floor; the controller also returns you before the pipe exit. Each full loop adds 850 base points. Use the side access ramps to reach their roofs. Rail bodies and supports also collide with the rider; jump onto the top along the rail's length to grind, then press Space to pop off.

Eight quarterpipe lips now have grindable metal coping. Hold **Shift** while riding up a quarterpipe to enter a coping grind directly, without jumping. Hold **E** instead to grab the board, turn 180 degrees and drop back into the ramp. Space pops off a grind; releasing Shift drops back into the ramp.

Choose **South Canal, West Rust Tunnel, East Rust Tunnel or Filter Halfpipe** in the home menu's **DROP POINT** selector. This changes where your next run starts. The plant plan marks your position with a yellow arrow, tunnels in orange and grind routes in cream.

The ground is one static surface shared with the physics layout. Ground textures stay fixed, distant textures use mipmaps, and animated water is confined to discharge streams and foam. This removes the moving floor colours, overlapping surface flicker and floor vertex jitter from the earlier version.

## Make it yours

Open **SELECT SURFER** for Kai, Nova, Reef or **Jax**, a standing 3D character preview, a biography and style ratings. The bodies use authored chest/shoulder contours, continuous clothing joins, baggy trousers, shaped hands, and fixed-length limb IK. Faces use the restored earlier painted style; cloth retains the original fold textures. The board-grab pose reaches the board rail. The menu frames the full figure with the board held edge-on beside it. Reference-based ranges and measured checks are documented in `BODY-RESEARCH.md`; these are original models, not recovered THPS2 assets. Ratings and stance labels describe their style; all four share the same movement physics.

All four can wear any of the **twelve outfits**, including oversized surf tees, an open tropical shirt, beachwear with a straw hat, a wetsuit and a long-sleeve rashguard. Jax starts in **Yard Crew**: a grey sweatshirt, baggy grey trousers, a backwards white cap, long dreadlocks and trainers. **Sun Crew** adds the yellow sweatshirt and navy trousers alternative.

Open **CUSTOMISE BOARD** to combine **five deck colours** with **eight original graphics**: Lightning, Checker Rip, Hot Rod, Black Tide, Hibiscus, Skull Reef, Solar Flare and Pinstripe. Your choices appear on the surfboard in every mode.

The selected character, outfit, board, mode, sound preference and personal bests save automatically in the current browser when local storage is available. They are not synced between devices or different preview addresses.

## Controls

| Key | Action |
| --- | --- |
| A / D or Left / Right | Carve across the wave; steer left / right in the park. |
| W / Up | Pump for speed. |
| S / Down | Slow down. |
| Space | Hold to charge, then release to pop. Every mode has 1.4 seconds of grounded pop recovery after landing. In ocean modes, use the lip or a completed cutback for trick airtime; flat hops are unscored. |
| E + A / D | Hold E inside a factory pipe; steer around the wall for a full loop. Release E to return to its floor. |
| E at a quarterpipe lip | Hold while approaching to grab the board and turn back into the ramp. |
| Shift at a quarterpipe lip | Hold while approaching to enter a coping grind without jumping. Release to drop in; Space pops out. |
| J | 180 spin while airborne. |
| K | Kickflip while airborne. |
| L | Indy grab while airborne. |
| U | Shuv-it: spin the board beneath the rider. |
| O | Heelflip while airborne. |
| H | Method Air while airborne. |
| F | 360 Air while airborne. |
| B | Tweaked Grab in any mode: tucked knees, board pulled beside the body, one hand on the rail and the free arm raised. |
| Shift + A / D (or Left / Right) | Turn while holding Shift to cut back on the wave face in any ocean mode. Either key order works. Release the steering/Shift or change direction to trigger another cutback after the cooldown. |
| C | Alternative cutback button. Steer A/D to choose the direction, or press C to reverse your current carving line. |
| I | Rodeo Air while airborne when the **SPECIAL** meter is full. |
| Enter | Bank a landed combo; start or replay from the menu/results. |
| P / Escape | Pause / resume. Escape also closes customisation. |
| R | Restart the current session. |
| M | Toggle music and effects. |

The **? Controls** panel pauses an active session. This version focuses on keyboard and desktop play. Losing focus or hiding the tab pauses an active run and clears held controls.

## Build a combo

- In an ocean mode, pump toward the pale crest band on the wave meter until the HUD says **LIP LAUNCH READY**, or complete a **Shift + A/D cutback**. Hold Space, release while that launch is ready, press K, finish the flip, land and press Enter. Flat-water hops cannot start aerial tricks.
- Every manual pop starts a **1.4-second recovery** that counts down only on the ground. It stays full while airborne. The pop meter shows when you can jump again. Natural ramp launches still carry you into the air and restart recovery.
- Landings tolerate ordinary steering drift. Use S to settle a rough approach; only a severe sideways slide causes a landing wipeout. An almost-finished trick gets a short automatic recovery window in every mode.
- Shift + A/D performs a short cutback with a fan of spray. C is an alternative. Finish it to earn a **2.2-second powered-pop window**; charge and release Space during that window for airtime. The cutback itself gives no score or SPECIAL charge. It has its own cooldown and cannot start during a jump or wipeout. A held Shift/turn combination waits until you are back on the water and ready, then fires once.
- B performs the **Tweaked Grab**, worth 650 base points. It replaces the old spinning barrel-roll move. In Storm Rider, a barrel is now the **wave curling overhead**: line up with its open mouth and ride through for a barrel bonus.
- Aim to finish each trick before landing. The final 20% of a move, up to 0.16 seconds, can recover at touchdown; a badly unfinished move still bails. One trick plays at a time. Each completed trick increases the multiplier, up to **×8**; repeated moves lose value within a combo.
- After landing, pop again within **3.8 seconds** to continue the combo. Enter banks it immediately; letting the combo meter expire also banks it. A wipeout loses the active combo.
- Completed tricks and banked points fill **SPECIAL**. Once it reaches **100%**, it stays ready through waiting and wipeouts until you use it. Press I during an air to spend the charge on Rodeo Air, and leave enough airtime to finish it. Restarting or returning to the main menu resets the meter. A partly filled meter slowly drains and loses charge on a wipeout.
- In Surf Session, sun rings award **250 points** and strong carving earns extra style points. In The Waterworks, launch from different ramps and jump onto a water rail **along its length** to slide. Pop off or ride off its end before landing and banking.
- In a timed mode, a grounded combo banks at the final buzzer. An airborne combo, active rail slide, pipe wall ride or lip move is forfeited. Storm Rider ends only when the last life is lost; its results include survived time, best survival time and barrel rides.

## Sound and video

**“Riptide Radio ’99”** is an original, mellow **64-bar instrumental at 108 BPM**, lasting about 2 minutes 22 seconds before it loops. Clean plucked-string guitar plays spacious melodies over warm bass, soft brushed drums and shaker. Seventh/add-nine chords, stereo chorus, slapback and reverb give it a relaxed coastal sound. The Waterworks adds a little extra percussion. Web Audio generates every note and effect; no music download is needed.

**“Afterhours / Yard Circuit”** is the original menu track: a 32-bar, 138 BPM arrangement of distorted picked guitar, bass and breakbeats, including a half-time section and final hook. It evokes the energy of 2000s racing menus without reusing a recording or melody. Menu/ride tracks crossfade.

Sound begins on your first menu click or **DROP IN**, unless you previously switched it off. Use **SOUND** or M to toggle it. Music stops while gameplay is paused. Browsers require a user interaction before audio can start.

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
| `src/park-camera.js`, `src/park-camera-rig.js` | Solid camera clearance and smooth follow through turns and pipe loops. |
| `src/storm-waves.js`, `src/barrel-wave.js` | Shared barrel shape/collision and the animated curling water surface. |
| `src/waterworks.js` | Factory architecture, wave ramps, rails and park scenery. |
| `src/appearance.js` | Outfits, board artwork, surfer assembly and standing preview. |
| `src/character-model.js` | Authored body geometry, fixed-length limb IK and board-grab contact. |
| `src/character-head.js` | Restored earlier painted face, head, hair and hats, isolated from body construction. |
| `src/character-textures.js`, `src/rider-atlas.js` | Original embedded photographic atlas and texture sampling. |
| `src/character-spec.js` | Independent reference-based ratio measurement and audits. |
| `src/audio.js` | Original heavy menu track, mellow ride instrumental and effects. |
| `src/session-modes.js` | Surf, Rush and Storm timing, hazards, currents and landing rules. |
| `src/rider-pose.js` | Shared trick choreography, sustained grab envelope and the banked Tweaked Grab pose. |
| `src/brand-art.js`, `src/summer99.css` | Embedded original rectangular logo and four-mode desktop menu. |
| `tests/` | Surf, park and SPECIAL regression checks. |

To tune the game, edit `SURF_RULES` in `session-modes.js` or `TRICKS` in `game.js`, the ramp definitions in `park.js`, or outfit/board choices in `appearance.js`. Keep the ocean shader in `world.js` aligned with `waveHeight()` in `game.js` when changing the wave shape.

## Character and movement review

With the development server running, open `/ride-lab.html` for pipe-loop, lip-grab and coping demonstrations, `/surf-lab.html` for grabs, curling waves and endless Survival, or `/audio-lab.html` for the original soundtrack. These pages use the production game code.

The separately supplied local download includes the body comparison and user-provided reference pictures. Those pictures and their review pages are deliberately excluded from this public repository; the game uses original artwork.

The generated logo is embedded in `src/brand-art.js`; the exact generation prompt is in `LOGO-PROMPT.txt`. The original face/clothing atlas prompt remains in `ART-PROMPT.txt`. Both were created with the built-in image-generation tool.

## Licence

Original project source is MIT licensed; see `LICENSE`. Dependencies retain their own licences. This independent project is not affiliated with Tony Hawk, Activision or Neversoft and uses no proprietary characters, logos, levels, recordings or artwork in gameplay. The separate model and body review pages contain user-supplied reference pictures for comparison; those pictures retain their owners' rights.
