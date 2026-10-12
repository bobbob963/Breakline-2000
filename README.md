# BREAKLINE ’99 — Version 8.0

**Published update — 12 October 2026.** Includes the rebuilt bodies with restored painted faces, improved Waterworks handling, five custom combo animations, The Hit List with five physical races, compulsory sun rings and landed trick boosts across Surf Session and Waterworks, and the third-wipeout WASTED sequence. Open this repository through the linked StackBlitz project to play the latest source.

A separately supplied local body comparison includes ten reference presets and matching camera controls. User-supplied reference images and their review pages remain local; this repository contains the original game artwork only.

Five custom combo animations work in every mode. Complete the first trick, then start the second while airborne: **J → L** for Crosswind Grab, **K → L** for Flip Catch, **U → H** for Deck Sweep, **L → F** for Coiled 360, or **J → B** for Crosscut Tweak. Crosscut adds a board twist, counterturned torso, tucked legs and an across-body free arm while the grabbing hand stays on the surfboard. The first move must finish; pressing both keys together does not queue a combo. You can link the pair across separate airs while the scoring combo remains unbanked. Banking, a wipeout, expiry or restarting clears the sequence. These are body/board animation variations with the original trick timing, scores, repetition penalties and special rules. The Controls panel lists them, and the HUD gives a follow-up key hint after a matching first move.

**Modes and presentation:** Storm Rider's third wipeout now freezes the fallen rider in a desaturated, slowly zooming scene beneath a red **WASTED** title. The original in-game sequence lasts 3.4 seconds before results; skip becomes available after 0.8 seconds. Input is isolated until it ends, and reduced-motion preferences disable the zoom. This is an original GTA-inspired presentation, not imported GTA footage or audio. `event-lab.html` runs a real three-wipeout Storm replay for inspection.

**The Hit List** is five head-to-head races: MOXIE on the west Waterworks circuit, RIVET over 960 metres of surf, UNDERTOW on two laps of the east Waterworks circuit, STATIC over 1,280 metres of surf, and KINGTIDE on two laps through both factory pipes. Waterworks routes include the main spine ramp for natural trick airtime. Every opponent is a visible rider using the same movement and collisions as the player, with fixed pacing and no catch-up speed. After the three-second countdown, hold **W** to pump and steer with **A/D**. Pass through every gold sun ring in order and finish first. Flying beside, over or backwards through a ring does not count. A missed ocean ring resets that rider just before it; in Waterworks, turn back and approach the missed ring from the correct side. The factory minimap shows your route, next ring and rival. No race has a time limit. Pausing freezes both riders; retry resets both. Completed ranks save automatically and existing unlocks are retained. **Enter / NEXT RIVAL** advances after a win; **R / RESTART** retries the same rival. A new ladder resets tournament progress only.

With the development server running, open `/combo-lab.html` to replay all five combinations. Each replay pauses during the custom move and can continue through landing; the ordinary finishing-trick option shows the default animation for comparison. An offline Combo-Replays.html is supplied separately.

**Waterworks handling:** B now reaches the Tweaked Grab in Waterworks through the same keyboard handler as the ocean modes. Hold Space to crouch and build speed on the ground, then release to pop; W still pumps, and using both never stacks the speed. Low-speed turns are tighter and the board follows your chosen heading more promptly. Releasing W carries more of your approach speed through the air and into the next ramp. Braking, Shift cutbacks, the 1.4-second pop recovery and the existing ramp/rail collision rules are retained.

This pass uses the [original Activision THPS2 manual](https://manualzz.com/doc/6906744/activision-tony-hawk-s-pro-skater-2-video-game-user-manual) for hold/release ollies, automatic forward acceleration and context-sensitive grinds, plus [RetroRobby's original PS1 Marseille gameplay](https://www.youtube.com/watch?v=p36Fk2BYepg&t=32s) as a visual reference. Inspected moments include the linked grind/manual/flip sequence around 0:33 and the airborne 360 Judo at 0:56. These establish the intended rhythm and continuity, not exact physics values. The new acceleration damping and turn rates are our own measured tuning for the surfboard game; this is not a reproduction of THPS2's engine.

A playable desktop 3D surf arcade made with **vanilla JavaScript, Three.js and Vite**. Five modes: Surf Session, The Waterworks, Reef Rush, Storm Rider and The Hit List. Four surfers, twelve outfits, a board workshop, nine aerial tricks and grounded cutbacks. Every mode uses a **surfboard**.

Version 8 adds **endless Storm Rider**, rideable curling barrel waves, gentler landing rules and a **B-key Tweaked Grab** inspired by the supplied aerial-pose reference. Survival ends only when all three lives are lost; the clock counts upward while speed, currents and barrel pressure increase.

Version 8 further reshapes the chest, waist and back, adds an uneven shirt hem, bent arms and an asymmetric resting stance, and rebuilds the hands and trainer soles, heels and toe boxes. Directional elbow, knee and cuff folds give the clothing more shape. The restored earlier painted faces are preserved. These bodies appear in both character selection and gameplay. `BODY-RESEARCH.md` records the reference measurements and visual checks.

The Waterworks camera follows turns smoothly, retracts around obstacles, recovers its distance gradually, and maintains stable orientation through pipe loops.

Waterworks cruising and pumping are now about 7% faster, with a slightly wider side angle and a gentle speed-dependent lens change. Braking and the centered pipe-loop camera keep their existing behavior. Shorts now conceal the covered upper-thigh mesh so skin cannot poke through the hip and seat during riding poses.

Waterworks ramps now carry the rider to the lip before launching. Charged pops preserve uphill momentum, kickers clear their rising surface, and quarterpipe airs turn smoothly back into the bowl. The coping sits at the actual ramp lip, with direct Shift grinds and E grab turnbacks still available.

Hold **Shift + A/D** for a sharp grounded cutback in Waterworks. The rider leans into the turn with a fan of spray; near the top of a quarterpipe, Shift still takes priority for coping. The bottom corner button groups have been removed. **Restart**, **Pixels / Video**, and **Main Menu** are available from Pause.

The rectangular surfwear graphic has tall black lettering over faded red, blue and yellow. It is original artwork inspired by the supplied 1990s print reference. The menu has a separate heavy guitar/breakbeat soundtrack; riding keeps the mellow surf score.

The original oval **BREAKLINE ’99 / EXTREME SURFING** badge returns in the surfer/board workshop, pause and results screens, and on the north and south Waterworks walls. The home page keeps its rectangular surfwear graphic.

A full-screen retro loading screen uses the oval badge, blue industrial grain, yellow lettering and a segmented orange bar. Progress follows actual startup stages (game files, rider textures, environments and first frame), with a tip for your selected mode. Controls unlock when the scene is ready; failed startup offers **TRY AGAIN**. It is included in both StackBlitz and the offline game.

Grabs now have a sustained hold. The hand follows a point on the actual board edge after the board and rider transforms, rather than reaching a fixed approximation for just one instant. The model keeps its limb lengths while crouching and gripping.

Every mode now requires **1.4 seconds of grounded recovery after landing before another manual pop**. In ocean modes, earn trick airtime by reaching the wave lip at speed or completing a **Shift + A/D cutback**. Flat-water hops and cutbacks alone give no points. The HUD shows pop recovery and the brief cutback-launch window.

## Play in StackBlitz

**Your project:** open [Breakline-2000 on StackBlitz](https://stackblitz.com/~/github.com/bobbob963/Breakline-2000). It loads the GitHub source. If a tab still shows an older version, reopen this link so StackBlitz imports the current source; the home menu should say **VOL. 08**.

Use StackBlitz to run this source project without installing development tools. A standalone offline Play-Breakline-99.html is available in the separately supplied local download.

**Latest online source:** the GitHub main branch now includes the five-race Hit List with coast and Waterworks rivals, compulsory sun rings and trick boosts. Reopen the StackBlitz import link to load current source. An older saved StackBlitz fork does not update automatically.

**Updating a saved fork:** replace its source with the current contents of this repository, including all src/ and tests/ files and all replay HTML entry points. Preserve package.json, index.html and the lockfile at the project root.

To import the source manually:

1. Open [a new Vite JavaScript project](https://vite.new/vanilla).
2. Drag the **contents** of the extracted `breakline-99` folder into StackBlitz’s Files panel and replace matching starter files. Keep `package.json`, `index.html`, `src/` and `tests/` at the project root.
3. In its terminal, run:

   ```sh
   npm install
   npm run dev
   ```

4. Open the preview in a new tab for the largest view and reliable keyboard focus.

StackBlitz normally starts the `dev` script automatically; do not start another server if one is already running. StackBlitz and dependency installation need an internet connection. The game needs WebGL 2 and hardware acceleration.

If a school or workplace filter blocks the `webcontainer.io` preview address, the project can finish loading while its game preview stays blocked. Ask the network administrator to review that address. Signing in or reimporting the project does not remove a network filter. The supplied `Play-Breakline-99.html` remains a self-contained offline copy.

Official guides: [import projects](https://developer.stackblitz.com/guides/user-guide/importing-projects) · [create with the SDK](https://developer.stackblitz.com/guides/integration/create-with-sdk).

## Choose your session

| Mode | How to ride | Third challenge |
| --- | --- | --- |
| **Surf Session — Sunset Point** | Two-minute score attack with currents, central reef obstacles and forgiving landing control. | Catch 6 sun rings. |
| **The Waterworks — Lower Sewage Works** | Steer through a 240 × 360 metre sunken factory basin, with 18 ramps/banks, 2 hollow rust tunnels and 18 grind lines. Wave lips launch you automatically; quarter pipes turn you back into the park. | Ride 5 different ramps. |
| **Reef Rush — Checkpoint Coast** | Start with 35 seconds. Each ring adds 8 seconds. Collect 12 rings to win. | Finish 12 checkpoints. |
| **Storm Rider — Squall Point** | Endless survival with 3 lives. Ride curling barrels as the current, pace and storm build over time. The timer counts upward; only losing all lives ends the run. | Ride through 3 barrels. |
| **The Hit List — Coast + Factory Circuit** | Three Waterworks circuit races and two Surf Session races against visible AI riders. Pass through every sun ring and finish first; landed tricks earn speed boosts. | Defeat KINGTIDE and become champion. |

The four freestyle/survival modes also challenge you to score **5,000 points** and bank **one 1,500-point combo**. The Hit List replaces these goals with race position and compulsory sun ring progress. Each mode has its own best score. Storm Rider also saves your longest survival time. Use **MAIN MENU** to change modes or customise your rider.

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
| Space | Hold to charge, then release to pop. In Waterworks, crouching also builds speed like W. Every mode has 1.4 seconds of grounded pop recovery after landing. In ocean modes, use the lip or a completed cutback for trick airtime; flat hops are unscored. |
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
| Shift + A / D (or Left / Right) | Cut back on the wave face, or make a sharp grounded turn in Waterworks. Near a quarterpipe lip, Shift catches the coping instead. Either key order works. Release the steering/Shift or change direction to trigger another cutback after the cooldown. |
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
- Shift + A/D performs a short cutback with a fan of spray. C is an alternative. In ocean modes, finish it to earn a **2.2-second powered-pop window**; charge and release Space during that window for airtime. In Waterworks it turns the board sharply, with no extra pop boost. The cutback itself gives no score or SPECIAL charge. It has its own cooldown and cannot start during a jump or wipeout. A held Shift/turn combination waits until you are back on the water and ready, then fires once.
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

Open **Pause** to find **PIXELS / VIDEO**, which switches between the 640-pixel retro view and a cleaner resolution. Both retain the low-poly models and textures. Restart and Main Menu are also in Pause; use **P / Esc** to open it or **R** to restart directly.

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
| `src/keyboard.js` | Shared production keyboard route, including B/Tweaked Grab in every mode. |
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

With the development server running, open `/ride-lab.html` for pipe-loop, lip-grab, coping, quarterpipe-air and charged-ramp-pop demonstrations, `/surf-lab.html` for grabs, curling waves and endless Survival, or `/audio-lab.html` for the original soundtrack. These pages use the production game code.

The separately supplied local download includes the body comparison and user-provided reference pictures. Those pictures and their review pages are deliberately excluded from this public repository; the game uses original artwork.

The generated logo is embedded in `src/brand-art.js`; the exact generation prompt is in `LOGO-PROMPT.txt`. The original face/clothing atlas prompt remains in `ART-PROMPT.txt`. Both were created with the built-in image-generation tool.

## Licence

Original project source is MIT licensed; see `LICENSE`. Dependencies retain their own licences. This independent project is not affiliated with Tony Hawk, Activision or Neversoft and uses no proprietary characters, logos, levels, recordings or artwork in gameplay. The separate model and body review pages contain user-supplied reference pictures for comparison; those pictures retain their owners' rights.

In all five Hit List races, land a completed aerial trick for an automatic **TRICK BOOST**: +6 m/s for 1.4 seconds. Two tricks in an unbanked combo give **COMBO BOOST**: +9 m/s for 2 seconds; longer combos build up to +13 m/s for 3 seconds. The boost meter appears above your speed. Use a Waterworks ramp, or a surf cutback/powered-pop or wave-lip launch, then complete and land a trick; empty flat hops and banking cannot refresh the boost. Braking suppresses the burst while its timer keeps running, pausing freezes it, and a wipeout or missed checkpoint cancels it. Other modes keep their existing speed rules.

For a development-only race review, open `/race-lab.html`. It can run any of the five rivals through the real controls without reading or changing your saved Hit List progress. The single-trick and combo demos use a cutback, charged pop and trick inputs, then pause on the landing so the boost can be inspected.
