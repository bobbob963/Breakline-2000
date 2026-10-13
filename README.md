# BREAKLINE ’99 — Version 8.0

**Secret admin panel:** on the home screen press **Left, Left, Right, Up**, with no more than two seconds between presses. Enable custom stats to tune the selected rider's jump power, gravity, trick speed, landing forgiveness, combo window, trick points, steering, air control and special charge. Tune the board's base speed, acceleration, boost strength and duration, pop cooldown, extra jumps and glide. Values save separately for each character and board; Apply saves, Cancel discards edits, and Restore defaults resets the selected setup. Switching custom stats off restores ordinary gameplay and the equipped prize board's normal perks. Rival stats are unchanged. The HUD marks an active custom setup.

**Give Me Everything** unlocks all ladders, Time Trials, reward boards, outfits and deck styles immediately, keeping existing personal bests and the current race selection. **Full Reset** asks for confirmation, then clears Breakline's progress, scores, selections, audio preference and custom stats in this browser and reloads a fresh game. It does not clear other site data. Saves on different game addresses remain separate.

**Game update — 13 October 2026.** Clearing all five Rival ladders unlocks **TIME TRIALS**: twelve sequential solo runs, with ten wave courses and two longer Waterworks circuits. Pass every sun ring before the target time; each new course demands a faster line. Every three first-time clears unlock a matching outfit and board graphic, for four complete cosmetic sets. Replays improve personal bests without awarding duplicate clears. Existing prize boards, perks and saved ladder progress are retained.

The Hit List has **five ladders and 25 rival races**. Clear each ladder to permanently unlock a distinctive prize board with custom trick effects and a gameplay perk. Rivals perform real aerial tricks and earn combo boosts on the coast and around Waterworks, with an energetic race soundtrack. Open `Play-Breakline-99.html` to play it, or `Compare-Bodies.html` to compare the previous v8 body with the v9 rebuild at the same camera angle. The old faces are retained. Standing shoulders, loose cloth and trainers have been reshaped; riding and charged crouches now keep the pelvis above the knees with a forward chest hinge. Waterworks has original worn-concrete and rust textures with neutral factory lighting. Its collision geometry is unchanged.

The main menu now shows your selected surfer leaning on their upright surfboard in the left panel. **SELECT SURFER** sits beneath the model. Character, outfit, deck paint and earned prize-board changes appear in this preview immediately; the existing session selection and board shop remain on the right. The resting pose is menu-only, with subtle idle motion disabled by reduced-motion preferences.

A separately supplied local body comparison includes ten reference presets and matching camera controls. User-supplied reference images and their review pages remain local; this repository contains the original game artwork only.

Ocean races now keep the camera slightly closer and use a sharper retro render, so RIVET and STATIC retain rider detail comparable to ordinary Surf Session. The low-poly models and painted textures keep their original style. Waterworks and freestyle cameras keep their existing framing; the video setting still offers the cleaner full-resolution option.

Five custom combo animations work in every mode. Complete the first trick, then start the second while airborne: **J → L** for Crosswind Grab, **K → L** for Flip Catch, **U → H** for Deck Sweep, **L → F** for Coiled 360, or **J → B** for Crosscut Tweak. Crosscut adds a board twist, counterturned torso, tucked legs and an across-body free arm while the grabbing hand stays on the surfboard. The first move must finish; pressing both keys together does not queue a combo. You can link the pair across separate airs while the scoring combo remains unbanked. Banking, a wipeout, expiry or restarting clears the sequence. These are body/board animation variations with the original trick timing, scores, repetition penalties and special rules. The Controls panel lists them, and the HUD gives a follow-up key hint after a matching first move.

**Modes and presentation:** Storm Rider's third wipeout now freezes the fallen rider in a desaturated, slowly zooming scene beneath a red **WASTED** title. The original in-game sequence lasts 3.4 seconds before results; skip becomes available after 0.8 seconds. Input is isolated until it ends, and reduced-motion preferences disable the zoom. This is an original GTA-inspired presentation, not imported GTA footage or audio. `event-lab.html` runs a real three-wipeout Storm replay for inspection.

**The Hit List** has five increasingly demanding ladders: **AMPLIFIER, LIVE WIRE, UNDERTOW, SOLAR FLARE and SKYBOUND**. Each contains five head-to-head races: MOXIE on the west Waterworks circuit, RIVET over 960 metres of surf, UNDERTOW on two laps of the east Waterworks circuit, STATIC over 1,280 metres of surf, and KINGTIDE on two laps through both factory pipes. Later ladders raise the rivals' fixed pace; every race remains winnable with a standard board. Waterworks routes include the main spine ramp for natural trick airtime. Every opponent is a visible rider using the same movement, collisions and basic boost rules as the player, with no catch-up speed. Rivals charge pops, perform spins and grabs, then earn a boost only after a clean landing. Watch their current trick and boost meter beside their name; a gold trail marks their active burst. After the three-second countdown, hold **W** to pump and steer with **A/D**. Pass through every gold sun ring in order and finish first. Flying beside, over or backwards through a ring does not count. A missed ocean ring resets that rider just before it; in Waterworks, turn back and approach the missed ring from the correct side. The factory minimap shows your route, next ring and rival. Hit List races have no time limit. Pausing freezes both riders; retry resets both.

**Reset a ladder whenever you want:** open **VIEW RIVAL LADDER**, then choose **RESET THIS LADDER**. During a rival race or its results, use **RIVAL LADDERS / RESET** in the pause/results menu. Resetting returns the selected ladder to race one and clears the current heat, boosts and combo; earned boards, unlocked ladders and equipped gear remain. Escape closes the ladder view and resumes a paused race if you have not reset or switched ladders.

**Ladder progress and rewards:** completed ranks save automatically. **Enter / NEXT RIVAL** advances after a win; **R / RESTART** retries the same rival. The fifth win clears the ladder, awards its board once and unlocks the next ladder. **NEXT LADDER** starts its first race. The rival list lets you select unlocked ladders; switching ladders starts the selected ladder at race one, replacing the active partial-rank progress while keeping every earned board. After all five ladders, **REPLAY LADDER** starts that ladder again with all five boards retained. Retrying a cleared final race, losing a replay or clearing the same ladder again never removes or duplicates rewards. Existing version-one saves migrate to the same rival in AMPLIFIER; an existing champion receives the AMPLIFIER board automatically. Saves remain local to the current browser and address.

With the development server running, open `/combo-lab.html` to replay all five combinations. Each replay pauses during the custom move and can continue through landing; the ordinary finishing-trick option shows the default animation for comparison. An offline Combo-Replays.html is supplied separately.

**Waterworks handling:** B now reaches the Tweaked Grab in Waterworks through the same keyboard handler as the ocean modes. Hold Space to crouch and build speed on the ground, then release to pop; W still pumps, and using both never stacks the speed. Low-speed turns are tighter and the board follows your chosen heading more promptly. Releasing W carries more of your approach speed through the air and into the next ramp. Braking, Shift cutbacks, the 1.4-second pop recovery and the existing ramp/rail collision rules are retained.

This pass uses the [original Activision THPS2 manual](https://manualzz.com/doc/6906744/activision-tony-hawk-s-pro-skater-2-video-game-user-manual) for hold/release ollies, automatic forward acceleration and context-sensitive grinds, plus [RetroRobby's original PS1 Marseille gameplay](https://www.youtube.com/watch?v=p36Fk2BYepg&t=32s) as a visual reference. Inspected moments include the linked grind/manual/flip sequence around 0:33 and the airborne 360 Judo at 0:56. These establish the intended rhythm and continuity, not exact physics values. The new acceleration damping and turn rates are our own measured tuning for the surfboard game; this is not a reproduction of THPS2's engine.

A playable desktop 3D surf arcade made with **vanilla JavaScript, Three.js and Vite**. Six modes: Surf Session, The Waterworks, Reef Rush, Storm Rider, The Hit List and unlockable Time Trials. Four surfers, sixteen outfits including four unlocks, a board workshop, nine aerial tricks and grounded cutbacks. Every mode uses a **surfboard**.

Version 8 adds **endless Storm Rider**, rideable curling barrel waves, gentler landing rules and a **B-key Tweaked Grab** inspired by the supplied aerial-pose reference. Survival ends only when all three lives are lost; the clock counts upward while speed, currents and barrel pressure increase.

Version 8 further reshapes the chest, waist and back, adds an uneven shirt hem, bent arms and an asymmetric resting stance, and rebuilds the hands and trainer soles, heels and toe boxes. Directional elbow, knee and cuff folds give the clothing more shape. The restored earlier painted faces are preserved. These bodies appear in both character selection and gameplay. `BODY-RESEARCH.md` records the reference measurements and visual checks.

The Waterworks camera follows turns smoothly, retracts around obstacles, recovers its distance gradually, and maintains stable orientation through pipe loops.

Waterworks cruising and pumping are now about 7% faster, with a slightly wider side angle and a gentle speed-dependent lens change. Braking and the centered pipe-loop camera keep their existing behavior. Shorts now conceal the covered upper-thigh mesh so skin cannot poke through the hip and seat during riding poses.

Waterworks ramps now carry the rider to the lip before launching. Charged pops preserve uphill momentum, kickers clear their rising surface, and quarterpipe airs turn smoothly back into the bowl. The coping sits at the actual ramp lip, with direct Shift grinds and E grab turnbacks still available.

Hold **Shift + A/D** for a sharp grounded cutback in Waterworks. The rider leans into the turn with a fan of spray; near the top of a quarterpipe, Shift still takes priority for coping. The bottom corner button groups have been removed. **Restart**, **Pixels / Video**, and **Main Menu** are available from Pause.

The rectangular surfwear graphic has tall black lettering over faded red, blue and yellow. It is original artwork inspired by the supplied 1990s print reference. The menu has a separate heavy guitar/breakbeat soundtrack; freestyle keeps the mellow surf score. Hit List races use the original 152 BPM **Overdrive / Sun Circuit** track: driving bass, picked guitar, punchier breakbeats, a synth hook and builds. Boosts add an octave hook and the final stretch opens up the percussion.

The original oval **BREAKLINE ’99 / EXTREME SURFING** badge returns in the surfer/board workshop, pause and results screens, and on the north and south Waterworks walls. The home page keeps its rectangular surfwear graphic.

A full-screen retro loading screen uses the oval badge, blue industrial grain, yellow lettering and a segmented orange bar. Progress follows actual startup stages (game files, rider textures, environments and first frame), with a tip for your selected mode. Controls unlock when the scene is ready; failed startup offers **TRY AGAIN**. It is included in both StackBlitz and the offline game.

Grabs now have a sustained hold. The hand follows a point on the actual board edge after the board and rider transforms, rather than reaching a fixed approximation for just one instant. The model keeps its limb lengths while crouching and gripping.

With a standard board, the four freestyle/survival modes require **1.4 seconds of grounded recovery after landing before another manual pop**; Hit List races and Time Trials use **1 second** and give ordinary pops enough height for basic tricks. SOLAR FLARE reduces those recovery times to **1.05 seconds** and **0.75 seconds** respectively. In non-race ocean modes, earn trick airtime by reaching the wave lip at speed or completing a **Shift + A/D cutback**; SKYBOUND also provides an extra airborne jump. Flat-water hops and cutbacks alone give no points. The HUD shows pop recovery and the brief cutback-launch window.

## Play in StackBlitz

**Your project:** open [Breakline-2000 on StackBlitz](https://stackblitz.com/~/github.com/bobbob963/Breakline-2000). It loads the GitHub source. If a tab still shows an older version, reopen this link so StackBlitz imports the current source; the home menu should say **VOL. 08**.

Use StackBlitz to run this source project without installing development tools. A standalone offline Play-Breakline-99.html is available in the separately supplied local download.

**Latest online source:** the GitHub main branch includes all five rival ladders, twenty-five coast and Waterworks races, five prize boards with unique effects and perks, twelve champion Time Trials, four unlockable outfit/deck sets, compulsory sun rings and rival combo boosts. Reopen the StackBlitz import link to load current source. An older saved StackBlitz fork does not update automatically.

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
| **The Hit List — Coast + Factory Circuit** | Five ladders of three Waterworks races and two Surf Session races each: 25 head-to-head races against visible AI riders. Pass every sun ring and finish first; landed tricks earn speed boosts. | Clear each ladder to permanently unlock its prize board. |

The four freestyle/survival modes also challenge you to score **5,000 points** and bank **one 1,500-point combo**. The Hit List replaces these goals with race position and compulsory sun ring progress. Each mode has its own best score. Storm Rider also saves your longest survival time. Use **MAIN MENU** to change modes or customise your rider.

In **Storm Rider**, the HUD shows **SURVIVED** time and a new swell stage every 30 seconds. Difficulty rises smoothly throughout the run: riding speed, current strength, rain and reduced visibility build while the barrel opening tightens. The increases stay within playable limits. Follow **BARREL AHEAD** toward the open lane, stay beneath the curling water and ride out cleanly for a bonus. The visible falling lip and roof have matching collision, so jumping into them can cost a life. The three-barrel challenge is a milestone; completing it does not end survival.

The Waterworks has **three connected drainage channels, a collection bowl and two halfpipes**, perimeter spillways, three spines, three kickers, two raised glide decks and two pipe-access ramps. Tall retaining walls, upper factory floors, catwalks, broken roofs, structural columns and leaking outfalls surround the riding area.

Both abandoned rust pipes have **open ends, curved rideable interiors and grind rails along their crests**. Their sides and ceilings are solid. Hold **E** inside a tunnel and steer with **A/D** to ride all the way around its inner wall. Release E to return safely to the floor; the controller also returns you before the pipe exit. Each full loop adds 850 base points. Use the side access ramps to reach their roofs. Rail bodies and supports also collide with the rider; jump onto the top along the rail's length to grind, then press Space to pop off.

Eight quarterpipe lips now have grindable metal coping. Hold **Shift** while riding up a quarterpipe to enter a coping grind directly, without jumping. Hold **E** instead to grab the board, turn 180 degrees and drop back into the ramp. Space pops off a grind; releasing Shift drops back into the ramp.

Choose **South Canal, West Rust Tunnel, East Rust Tunnel or Filter Halfpipe** in the home menu's **DROP POINT** selector. This changes where your next run starts. The plant plan marks your position with a yellow arrow, tunnels in orange and grind routes in cream.

The ground is one static surface shared with the physics layout. Ground textures stay fixed, distant textures use mipmaps, and animated water is confined to discharge streams and foam. This removes the moving floor colours, overlapping surface flicker and floor vertex jitter from the earlier version.

## Make it yours

**Time Trials:** complete all five Rival ladders, then choose **TIME TRIALS** on the home menu or its shortcut on the final ladder result. The twelve courses unlock in order: ten run along the wave, while trials 6 and 12 use extended **1.6 km and 1.9 km Waterworks routes** around the existing plant. These longer circuits link both pipe corridors, ramps and drainage channels; they do not enlarge the factory's physical boundaries. Pass every sun ring in order before time runs out. Landed tricks and combos provide race boosts, and equipped ladder-board perks still work. Later targets require a quicker average pace within each venue. **NEXT TIME TRIAL** advances after a first clear; **R / RESTART** retries the same course. The trial list lets you replay completed courses and displays your best times. Resetting a Rival ladder does not relock Time Trials or remove its rewards.

| Unique Time Trials cleared | Outfit and board graphic unlocked |
| --- | --- |
| **3** | **AFTERHOURS** — ink-black oversized tee, violet shorts and neon night-slash deck art. |
| **6** | **RIP CURRENT** — seafoam rashguard, teal shorts and layered breaking-wave art. |
| **9** | **FURNACE** — rust sweatshirt, full cargo trousers and an industrial pressure-gauge deck. |
| **12** | **CHRONO CREW** — cream racing raglan, checked shorts and championship stopwatch art. |

Choose **EQUIP SET** on the trial list/results, or select the earned pieces separately in the wardrobe and board shop. These rewards are cosmetic. Equipping a complete set selects its standard deck graphic; equip a ladder prize board again to use that board's perk with the new outfit. All earned clothes, graphics and prize boards remain available. Completing the same trial repeatedly improves its best time but never counts as another unique clear.

Open **SELECT SURFER** for Kai, Nova, Reef or **Jax**, a standing 3D character preview, a biography and style ratings. The bodies use authored chest/shoulder contours, continuous clothing joins, baggy trousers, shaped hands, and fixed-length limb IK. Faces use the restored earlier painted style; cloth retains the original fold textures. The board-grab pose reaches the board rail. The menu frames the full figure with the board held edge-on beside it. Reference-based ranges and measured checks are documented in `BODY-RESEARCH.md`; these are original models, not recovered THPS2 assets. Ratings and stance labels describe their style; all four share the same movement physics.

All four can wear any of the **twelve starting outfits** and four earned Time Trials outfits, including oversized surf tees, an open tropical shirt, beachwear with a straw hat, a wetsuit and a long-sleeve rashguard. Jax starts in **Yard Crew**: a grey sweatshirt, baggy grey trousers, a backwards white cap, long dreadlocks and trainers. **Sun Crew** adds the yellow sweatshirt and navy trousers alternative.

Open **CUSTOMISE BOARD** to combine **five deck colours** with **eight starting graphics**: Lightning, Checker Rip, Hot Rod, Black Tide, Hibiscus, Skull Reef, Solar Flare and Pinstripe. Four additional illustrated deck styles unlock through Time Trials. Your choices appear on the surfboard in every mode.

The **BOARD SHOP** also displays six prize boards. Locked cards show the required ladder or Time Trial clears; after a clear, choose **EQUIP BOARD** on its result card or in the shop. Each board has original deck artwork and a brief effect around the rider and board whenever a trick completes. These are local bursts, not full-screen flashes. Equipping one board activates **its own powers; different boards do not stack**. Choosing **STANDARD BOARD**, a deck colour or a standard graphic returns to your custom standard board with no perk. Earned prize boards stay in your collection.

| Ladder / prize board | Trick-completion effect | Equipped perk |
| --- | --- | --- |
| **1 — AMPLIFIER** | Musical notes burst from the guitar deck. | **+25% aerial trick points** before the combo multiplier; ordinary checkpoint and other non-trick points are unchanged. |
| **2 — LIVE WIRE** | Completed tricks throw up original graffiti tags: **NICE!**, **WOW!**, **SICK!**, **RAD!**, **FRESH!** and **STYLE!**, with painted outlines, drips and small electric sparks. Tags rise beside the rider and fade; no screen flash. | **+25% race boost power** on cleanly landed trick and combo boosts. |
| **3 — UNDERTOW** | Spiralling water curls around the rider and vortex deck. | **+35% race boost duration**. |
| **4 — SOLAR FLARE** | Sharp sun rays and warm flare bursts punctuate each trick. | **25% faster pop recovery** in every mode. |
| **3 Time Trials — AFTERBURNER** | Orange exhaust flares and purple embers lift off the turbine deck after completed tricks. | **+25% base riding speed and +50% bonus trick/combo boost speed**. |
| **5 — SKYBOUND** | Angel wings unfold around the board during a downward glide, with feathered trick bursts. | **Automatic gentle downward glide + one extra airborne jump per flight** in every mode. |

**AFTERBURNER** unlocks permanently after your first **three distinct Time Trial clears**, alongside the Afterhours outfit and deck graphic. Existing saves with three or more clears qualify automatically. Base cruising/pumping speed is multiplied by **1.25**, and extra race-boost speed is multiplied separately by **1.5**: the normal +6 / +9 / +13 m/s boosts become **+9 / +13.5 / +19.5 m/s**. Braking and wipeout speeds stay manageable. The new board does not add another ladder or replace any existing prize.

With **SKYBOUND** equipped, your ordinary jump rises normally, then angel wings open around the board and slow your descent automatically. The glide always moves downwards and still collides with the terrain, pipes and rails. Finish your current trick, then press and release **Space** again while airborne for the second jump. It adds lift to the same flight and temporarily folds the wings until you descend again, so the combo continues and the race boost still requires a clean landing. Landing recharges the extra jump; holding Space, unfinished tricks and changing boards mid-flight cannot refill it. The LIVE WIRE and UNDERTOW boost perks apply to Hit List races and Time Trials; their artwork and trick effects appear in every mode.

The selected character, outfit, board, mode, sound preference and personal bests save automatically in the current browser when local storage is available. They are not synced between devices or different preview addresses.

## Controls

| Key | Action |
| --- | --- |
| A / D or Left / Right | Carve across the wave; steer left / right in the park. |
| W / Up | Pump for speed. |
| S / Down | Slow down. |
| Space | Hold to charge, then release to pop. In Waterworks, crouching also builds speed like W. Standard recovery is 1 second in Hit List and Time Trials, and 1.4 seconds elsewhere; SOLAR FLARE reduces it by 25%. Races allow basic tricks from ordinary pops. In non-race ocean modes, use the lip or a cutback for trick airtime. With SKYBOUND, press and release Space again after the current trick finishes for one extra airborne jump; land to recharge it. |
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

- In a non-race ocean mode, pump toward the pale crest band on the wave meter until the HUD says **LIP LAUNCH READY**, or complete a **Shift + A/D cutback**. Hold Space, release while that launch is ready, press K, finish the flip, land and press Enter. Standard flat-water hops cannot start aerial tricks; a SKYBOUND second jump supplies trick airtime. Hit List and Time Trials pops already have enough height for basic tricks.
- Every manual pop starts a **1.4-second recovery** (**1 second in Hit List races and Time Trials**) that counts down only on the ground. SOLAR FLARE reduces either duration by 25%. Recovery stays full while airborne. The pop meter shows when you can jump again. Natural ramp launches still carry you into the air and restart recovery.
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
| `src/tournament.js`, `src/tournament-progress.js` | Five ladder definitions, 25 race selections, save migration and permanent prize unlocks. |
| `src/time-trials.js`, `src/time-trial-progress.js` | Twelve timed solo courses, championship gate, sequential clears and saved personal bests. |
| `src/time-trial-ui.js`, `src/time-trials.css`, `src/trial-cosmetics.js` | Trial list/results, four outfit/deck reward sets and unlock thresholds. |
| `src/surf-race.js`, `src/park-race.js`, `src/race-rider.js` | Shared player/rival trick boosts, physical races and compulsory sun-ring checks. |
| `src/board-rewards.js`, `src/board-effects.js`, `src/rewards.css` | Prize-board perks, local trick-completion effects and collection/ladder presentation. |
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
| `src/audio.js` | Original heavy menu track, mellow freestyle instrumental, dynamic race soundtrack and effects. |
| `src/session-modes.js` | Surf, Rush and Storm timing, hazards, currents and landing rules. |
| `src/rider-pose.js` | Shared trick choreography, sustained grab envelope and the banked Tweaked Grab pose. |
| `src/brand-art.js`, `src/summer99.css` | Embedded original rectangular logo and desktop mode menu. |
| `tests/` | Surf, park and SPECIAL regression checks. |

To tune the game, edit `SURF_RULES` in `session-modes.js` or `TRICKS` in `game.js`, the ramp definitions in `park.js`, or outfit/board choices in `appearance.js`. Keep the ocean shader in `world.js` aligned with `waveHeight()` in `game.js` when changing the wave shape.

## Character and movement review

With the development server running, open `/ride-lab.html` for pipe-loop, lip-grab, coping, quarterpipe-air and charged-ramp-pop demonstrations, `/surf-lab.html` for grabs, curling waves and endless Survival, or `/audio-lab.html` for the original soundtrack. These pages use the production game code.

The separately supplied local download includes the body comparison and user-provided reference pictures. Those pictures and their review pages are deliberately excluded from this public repository; the game uses original artwork.

The generated logo is embedded in `src/brand-art.js`; the exact generation prompt is in `LOGO-PROMPT.txt`. The original face/clothing atlas prompt remains in `ART-PROMPT.txt`. Both were created with the built-in image-generation tool.

## Licence

Original project source is MIT licensed; see `LICENSE`. Dependencies retain their own licences. This independent project is not affiliated with Tony Hawk, Activision or Neversoft and uses no proprietary characters, logos, levels, recordings or artwork in gameplay. The separate model and body review pages contain user-supplied reference pictures for comparison; those pictures retain their owners' rights.

In all **25 Hit List races and 12 Time Trials**, land a completed aerial trick for an automatic **TRICK BOOST**: +6 m/s for 2 seconds with a standard board. Two tricks in an unbanked combo give **COMBO BOOST**: +9 m/s for 2.6 seconds; longer combos build up to +13 m/s for 3.6 seconds. LIVE WIRE multiplies boost power by 1.25, while UNDERTOW multiplies duration by 1.35; only the equipped board's perk applies. Hold **Space** briefly, release, press **J**, and land for a simple boost. Charge longer and follow the completed J spin with **L** for a stronger combo boost. Ramps, wave lips and cutbacks still provide bigger airs. Standard race pop recovery is 1 second on the ground, or 0.75 seconds with SOLAR FLARE; empty hops and banking cannot refresh a boost. The boost meter appears above your speed. Both player and rivals earn boosts through completed tricks and clean landings. Braking suppresses the burst while its timer keeps running, pausing freezes it, and a wipeout or missed checkpoint cancels it. Boost perks do not introduce race boosts into freestyle or survival modes.

For a development-only race review, open `/race-lab.html`. It can run any of the five rivals through the real controls without reading or changing your saved Hit List progress. The single-trick and combo demos pause on the landing so the boost can be inspected. Watch rival grab and combo-boost replays to inspect the opponent performing real moves and earning its burst, using ordinary game controls.
