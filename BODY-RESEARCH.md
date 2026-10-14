# Body reference study

This study concerns the body, clothing silhouette and pose. Face restoration is a separate task; these findings do not call for changing the approved facial design. The target is an original adult, low-poly late-1990s surf/skate character inspired by the supplied references, without reproducing their logos or textures.

## Evidence and measurement limits

The supplied reference files were inspected directly:

| Reference filename | Image | Useful evidence |
| --- | --- | --- |
| `codex-clipboard-768f828b-a212-4c0e-a8bc-86eb95085d67.png` | 480 × 416; grey and yellow sweatshirt characters | Primary standing clothing reference: relaxed arms, baggy trousers, narrow leg gap and hems over shoes. |
| `codex-clipboard-d9f7d867-34a5-4d1f-9d17-7660bfa0e1fa.png` | 415 × 416; grey tee, long shorts, T-pose | Shoulder-to-sleeve continuity, tapered forearms, hand scale and shorts length. |
| `codex-clipboard-86062400-d3d5-4380-bb64-20f67627fb3a.png` | 750 × 650; grey tee, dark trousers, angled T-pose | Broad angular clothing planes, substantial hands, trouser folds and shoe silhouette. |
| `codex-clipboard-8abb7f61-9ae8-432d-b79a-f8e6327ea255.png` | 480 × 416; three standing skaters | Natural shoulder slopes, integrated short sleeves and variation in baggy shorts. |

The saved production image `../breakline-v5-jax.jpg` was also inspected. The numerical model baseline below comes from the generated Jax / Yard Crew geometry in `src/character-model.js`, in its standing pose at time zero, before the current body revision. It is not a measurement of a new final render.

Reference pixel measurements are approximate: perspective, pose, low resolution, antialiasing and clothing folds affect the silhouette. They guide appearance and are not universal anatomical specifications. Model measurements are actual world-space mesh intersections or joint distances; those numbers alone cannot prove a visual match.

## Main findings

**Relax the arms before widening the whole body.** In the grey sweatshirt reference, the shoulder/sleeve outline continues nearly straight down the body. In the saved Jax render, the elbows flare outward and produce an abrupt inward kink at the cuffs. The baseline shoulder width is already close to the reference ratio; the much wider elbow envelope is the larger mismatch.

**Close the standing trouser gap before simply thickening both legs.** The reference trouser legs almost meet, with an irregular narrow slit appearing relatively low. The baseline has a conspicuous long gap between two separate tubes. Its individual trouser-leg widths are already fairly close to the reference. A narrower relaxed stance, connected seat and crotch cloth, and folds resting over the shoes address the silhouette more directly.

**Make the shoulder and sleeve read as one garment.** The baseline sleeve begins with a small radius and immediately expands, giving a narrow attachment followed by a bulge. The reference has a continuous sloping shoulder, a substantial upper sleeve and a gradual taper toward the cuff. The collar should sit against the neck, with no exposed gap, detached ring or sharp shelf running across the shoulders.

**Keep substantial hands and plausible shoes.** The references themselves use angular, fairly large hands. Baseline hand length and shoe length are plausible; blanket shrinking or enlarging them is not supported. Much of the footwear mismatch comes from how the trouser hems meet the shoes.

## Approximate reference coordinates

Coordinates use the image origin at the upper left. For the grey sweatshirt figure in `768f…`, crown is approximately y=26 and the shoe sole is approximately y=370, giving visible body height **H≈344 px**. The skateboard is excluded.

| Observation | Approximate image evidence | Appearance implication |
| --- | --- | --- |
| Shoulder and sleeve envelope | At y=100, x=110–197; at y=130, x=109–203; at y=195, x=110–197 | The full clothed outline stays around 0.25–0.27H wide through much of the upper body, rather than flaring strongly at the elbows. These spans include sleeves, not just the torso. |
| Shirt hem | Around y=198–206 | Hem falls around 0.48–0.50H above the soles, with an uneven cloth edge. |
| Separate lower trouser legs | At y=280, approximately x=121–159 and x=163–199 | Individual widths are about 37–39 px, or 0.11H. |
| Narrow inner-leg slit | White background begins around y=273; the visible slit is about 2–3 px at y=280–320 | The opening is only about 0.006–0.009H wide. Its first visible point is about 0.28H above the soles. This describes cloth overlap and stance, not the anatomical crotch position. |
| Trouser-to-shoe transition | Outline widens and changes direction around y=330–360 | The hem bunches and rests on the shoe; the lower leg is not a perfectly straight tube. |

In the grey-tee T-pose (`d9f…`), visible body height is approximately 393 px and the right hand occupies about 32 px along the arm direction, or **0.08H**. The darker angled T-pose (`860…`) has more exaggerated hands. These different references support a range rather than a single mandatory hand ratio.

## Exact baseline model observations

The generated standing Jax / Yard Crew visible geometry measured **H=1.8012 m**. Horizontal slice measurements include actual transformed triangles, not declared landmark widths.

| Baseline observation | Measured value | Interpretation |
| --- | --- | --- |
| Full shoulder slice near y=1.45 | About 0.475 m, or 0.264H | Already comparable to the grey reference's outer upper-body breadth. |
| Sleeve envelope near y=1.04 | About 0.653 m, or 0.363H | Much broader than the shoulder slice; neutral elbow flare dominates the body outline. |
| Right shoulder and elbow x positions | Shoulder x=0.2142; elbow x=0.3272 | Elbow moves 0.113 m outward in the standing pose. |
| Torso-only chest slice at y=1.38 | 0.4218 m, or 0.234H | The torso is not uniformly extremely narrow; silhouette and connections matter more than one breadth value. |
| Torso-only lower slice at y=1.04 | 0.3788 m, or 0.210H | There is a moderate chest-to-waist taper. |
| Individual trouser widths at y=0.15–0.40 | Approximately 0.173–0.203 m, or 0.096–0.113H | Similar order to the reference's individual lower-leg cloth widths. |
| Inner trouser gap at y=0.15–0.40 | Approximately 0.094–0.112 m, or 0.052–0.062H | Several times the reference's narrow slit; stance and connected drape need attention. |
| Standing ankle x positions | Left −0.148; right +0.165 | 0.313 m separation contributes to the large gap. Riding stance may appropriately remain wider. |
| Fixed upper arm / forearm / hand length | 0.320 / 0.290 / 0.150 m | Hand is 0.083H; it is not independently established as too long. Preserve fixed limb lengths during animation. |

The baseline sleeve ring radius starts at 0.036 m and expands to 0.063 m shortly below the shoulder. This explains the plugged-in sleeve impression. The baseline non-wetsuit pelvis consists of separate front and back panels between leg meshes; a visually continuous seat and crotch is needed in side and back views as well as the front. Shoe length is approximately 0.24 m including the authored heel/toe extent; that is a derived estimate rather than a horizontal silhouette measurement.

## Visual acceptance checklist

Review the actual production model under neutral light, at an equivalent screen height, with the real cloth textures. Use both Jax / Yard Crew and a short-sleeve/shorts outfit. A passing geometry test is supporting evidence, not visual approval.

| View or pose | What to verify |
| --- | --- |
| Front standing | Sloping connected shoulders; sleeves close to torso; no exaggerated elbow flare; shirt hem overlaps the waist; narrow natural trouser slit; hands beside thighs; cuffs rest over footwear. |
| 45-degree standing | Adult chest depth and a continuous armhole; no sleeve plug, shoulder shelf or detached collar; seat and crotch form one garment; hands and feet have convincing volume. |
| Side standing | Chest and back have useful depth; neck joins torso cleanly; sleeve and elbow remain tapered; pelvis has a seat rather than a flat patch; trouser hems meet shoe uppers without floating. |
| Back standing | Shoulder slope continues across the back; no open armholes or seat holes; shirt and trousers overlap; folds and cuff shape remain plausible from behind. |
| Riding and crouching | Wider riding stance is intentional; thighs, hips and sleeves bend without clipping holes or detached pieces; knees articulate rather than telescope; feet stay planted on the board. |
| Full grab hold | Actual hand remains on the actual board rail for the full hold; arms retain their lengths; connected shoulder and crotch cloth survive the deep pose; no severe body/deck intersections. |

Do not enforce the standing narrow-leg gap during a crouch or board stance. Do not alter faces to compensate for a clothing or body-silhouette problem.

## Final verification

The revised v7 body was independently inspected in actual rendered screenshots on 9 October 2026. **The body silhouette is substantially closer to the supplied references and is accepted with the limits below.** This is a visual judgment supported by measurement, not a claim that passing numeric ranges establishes resemblance.

Evidence inspected:

- `breakline-v7-body-comparison.jpg`: final textured Jax / Yard Crew, front standing, beside the prior body at the same camera and scale.
- `body-tee-final.jpg`: final Kai / Riptide '99, three-quarter standing, checking a different outfit and exposed limbs.
- `body-back-final.jpg`: final Jax back standing.
- `body-crouch-final.jpg` and `body-grab-final.jpg`: final Jax three-quarter crouch and grab with the actual board visible.
- `body-side-pass2.jpg`: neutral-material side view before the final small shoulder, sleeve-skin and hem corrections. This establishes side volume for that pass; a separate final side capture was not part of this review.

The first image is saved in the workspace's `outputs` folder; the other evidence images are in its `work` folder. These filenames describe the reviewed evidence and are not dependencies of the game.

### Measured result

The final generated Jax / Yard Crew standing model measured **H=1.81789 m**, including the restored head. Its lowest visible geometry is y=0.00427 m. The final shoulder correction was measured again after the screenshot pass; the pass-2 shoulder width is not substituted for the final value.

| Measure | Before | Final | Assessment |
| --- | --- | --- | --- |
| Clothed shoulder slice near y=1.45 | About 0.475 m / 0.264H | 0.46758 m / 0.257H | Within the reference's approximate outer upper-body breadth; the final shoulder corners visibly slope rather than form raised square tabs. |
| Sleeve-plus-torso envelope near y=1.04 | About 0.653 m / 0.363H | 0.52617 m / 0.289H | Large reduction in neutral elbow flare, visibly confirmed in the front and back screenshots. |
| Lower inner-trouser gap, y=0.15–0.40 | About 0.094–0.112 m / 0.052–0.062H | 0.02106–0.02400 m / 0.0116–0.0132H | Much closer to the reference's narrow slit. The small remaining difference is reasonable given the different pose and camera. |
| Shirt hem above the model's lowest geometry | Baseline hem near y=0.906 m | 0.88796 m / 0.48845H | Matches the reference estimate of approximately 0.48–0.50H above the sole. |

### Visual findings

The final front view has connected sloping shoulders, arms hanging beside the torso, a straight baggy sweater drape and a narrower relaxed stance. The torso no longer sits above an isolated underwear-like pelvis shape. The trousers form a connected garment with a small central slit, and their hems meet the shoes. The back view confirms that the seat and shoulder corrections are not merely front-facing patches; no open seat or armhole is apparent in that view.

Kai's short-sleeve outfit shows a more coherent sleeve-to-arm join, a covered waistband and a convincing long-shorts silhouette. The crouch and grab retain substantial thigh, seat and sleeve volumes without the prior disconnected body impression. The grabbing hand visibly reaches the board; precise contact throughout animation is a separate geometry/animation check, not something a single still can establish.

### Remaining limits

- The trouser folds remain more regular and the standing pose more symmetrical than the supplied character art. This is still an original low-poly model, not a reconstruction of those source meshes.
- A thin dark line remains near the rear shoulder in the final Jax grab image, around screenshot coordinate x=654, y=388. The separate geometry audit sampled 1,330 rays in this region and found no exposed skin or nearer back-facing surface: the foreground was torso/sleeve cloth, with only two hair samples at the upper boundary. That evidence supports a minor cloth/hair edge or shading line rather than an exposed geometry seam. It was left unchanged.
- Visual inspection covered the named Jax and Kai outfits and poses. It does not imply that every character/outfit combination was individually rendered from every angle. Automated geometry checks, production gameplay checks and face-restoration checks are separate evidence.

The final containment correction adds a trouser-yoke ring immediately below the hem matching the shirt's eight-sided contour. All nine character-model tests passed after that correction; this is additional geometry evidence alongside the visual review above.

## V8 body refinement — 10 October 2026

This pass addresses the remaining regular folds and rigid standing posture identified above. The previous v7 source is retained as `src/character-model-v7-reference.js` for the same-camera comparison. The accepted painted head builder and face textures in `src/character-head.js` are unchanged. All construction described here is original geometry; the supplied pictures guide the silhouette, rather than supplying copied meshes or textures.

### Shape and pose changes

The torso now has distinct chest, back and abdomen contours. The loose-shirt waist half-width changes from 0.207 to 0.195 m before character build scaling, while the lower chest changes from 0.214 to 0.217 m. These are implementation parameters, not measurements inferred from the photographs. The resulting garment keeps room around the waist but no longer has the same almost rectangular cross-section all the way down. The open lower edge drapes unevenly by 20 mm; the hidden waistband containment is lowered with it to preserve the previously corrected overlap.

Sleeves retain their joined shoulder boundaries while acquiring a slightly bent elbow silhouette, tapered forearm and small directional cuff folds. Trouser mass varies through thigh, knee and ankle, with broader folds above the cuffs. These are controlled changes to the mesh outline, not texture noise or alternating star-shaped knee rings. The narrow lateral standing stance is retained. Weight shifts subtly over one leg and the other foot sits farther back, giving the two knees different flexion.

Hands have flatter palm/finger profiles while retaining their 0.150 m physical wrist-to-tip length. Shoes now use a purpose-built last with a heel, instep, flatter sole, broad toe box and bevel; visible laces sit on the upper surface. They no longer reuse a rounded limb tube as their shape. The Jax/Yard Crew comparison reports 2,973 triangles versus the retained v7 model's 2,813 triangles, including the visible head and clothing.

### Direct comparison measurements

The joint angles below are calculated from the actual posed shoulder/elbow/wrist and hip/knee/ankle coordinates. An interior angle of 180° means straight. They describe the original models' neutral poses, not a claimed measurement of the source character's hidden skeleton.

| Jax / Yard Crew measure | Retained v7 | V8 |
| --- | --- | --- |
| Left / right elbow angle | 165.2° / 168.1° | 156.3° / 149.3° |
| Left / right knee angle | 175.4° / 173.1° | 160.2° / 167.1° |
| Lateral ankle separation | 0.243 m | 0.243 m |
| Fore/aft ankle separation | 0.039 m | 0.070 m |
| Actual torso-local hem height variation | 0 mm | 20 mm |

Across the 48 current character/outfit combinations, the generated standing geometry measures **1.7888–1.8212 m** high. The actual painted face height is **0.1343–0.1367** of visible body height. This small ratio range reflects body pose and outfit geometry rather than a replacement face. For the eight full-trouser sweatshirt combinations, actual chest width is **0.2213–0.2448H**, chest depth **0.1558–0.1564H**, and the complete sleeve envelope **0.2897–0.3131H**. The largest tested lower inner-leg gap is **0.0305 m**. These retain the previous test limits; none was widened to admit this pass.

### Rendered review and regression evidence

The root review accepted Jax front and three-quarter standing, a plain-material side view, crouch and grab with the board, and Kai/Riptide's short-sleeve outfit. Reviewed evidence includes:

- `outputs/breakline-v8-body-comparison.jpg`: equal-camera textured front comparison of v7 and v8, alongside the supplied reference pictures.
- `work/body-v8-crouch.jpg`: posed cloth and limb continuity in the crouch.
- `work/body-v8-grab.jpg`: the board grab with the revised body.
- `outputs/breakline-v8-tweaked-grab.jpg`: the production raised-arm tweaked grab; the renderer reports zero measured hand-to-rail error at the captured hold.

These paths are relative to the task workspace, not the source project. The side and tee inspections are recorded review observations; the listed images do not pretend to show every angle or every outfit.

The geometry checks retain all 48 combinations, nine demanding ordinary poses, 12,096 actual joined cloth vertices, 1,248 transformed hand-to-deck contacts, and 336 tweaked-grab entry/hold/release poses with real foot geometry on the board bindings. New regression checks measure the actual neutral joint angles over the breathing cycle and intersect the generated shirt triangles to detect a return to a rectangular waist. They also inspect the real open hem boundary, rather than an authored hem marker. Existing fixed-limb-length, crouch, cutback and contact checks remain unchanged.

All **12 character-model tests passed** after this pass. The new triangle-slice check measures a loose-shirt waist/chest ratio of **0.9241**, and the actual open-edge hem variation is **20.0 mm**. Across all four riders and the sampled breathing cycle, measured elbow angles are **149.1–156.3°** and knee angles **158.9–168.4°**.

The model remains a stylized original low-poly interpretation. The reference pictures do not establish exact hidden depth, topology or joint positions, and numeric tests cannot establish visual likeness. Rendered comparison and production contact checks therefore remain complementary evidence.

## V9 local art and posture pass — 11 October 2026

The supplied references span early THPS2 presentations: the Bob selection screenshot has coloured A/B/X/Y prompts, so a single exact PS1-only specification would be misleading. The target is the references' adult low-poly silhouette, readable painted folds, matte industrial materials and close rear chase composition. Exact original mesh topology, atlas sizes and camera FOV remain unverified.

The [firsthand THPS2 PC rendering investigation](https://partymod.newnet.city/writeups/1.html) distinguishes the PC port's Dreamcast texture replacements and gamma treatment from PS1 texture/vertex-colour modulation. The [original PlayStation manual](https://www.thegameisafootarcade.com/wp-content/uploads/2017/06/Tony-Hawks-Pro-Skater-2-Game-Manual.pdf) describes the abandoned Hangar's rails, halfpipes, kickers, funboxes and rusted aircraft. These inform material and scene treatment, not claimed exact mesh counts. Original supplied images remain local comparison references, not game assets.

### Changes and measured cross-checks

- Old painted head geometry and face textures remain unchanged. Four characters, twelve outfits and all board choices are retained.
- Ordinary grounded pelvis rises from .80 to .90 m; full-charge pelvis rises from .486 to .650 m. A forward chest hinge replaces the seated silhouette. Full charge keeps hips at least .159 m above both knees, with a measured 38.1-degree torso hinge. Arms balance asymmetrically and remain nearer the body.
- Shoulders slope into slightly broader/deeper chest planes. Trousers have less regular knee/shin/cuff sections; shoes have broader, flatter lasts. Jax/Yard Crew remains 2,973 triangles; shape rather than polygon count is the focus.
- Standing body height across all 48 combinations is 1.7899–1.8223 m; face/body ratio .1342–.1366. Baggy chest width .2284–.2527H, chest depth .1610–.1615H, sleeve envelope .2881–.3112H. Largest sampled inner-leg gap is .0288 m. Existing anatomy limits were retained.
- 240 grounded charge poses preserve four fixed limb lengths and planted feet. Existing checks still cover 12,096 joined cloth vertices (zero seam gap), 13,824 covered-hip rays, 1,248 transformed hand/deck contacts and 336 tweaked-grab poses. All 15 model tests pass.
- Waterworks uses deterministic original 128px concrete/iron/steel textures with larger stains, seams, cracks and edge wear. All 49 render mesh position/index hashes match the previous scene, including 191,676 terrain vertices and 460,695 terrain indices. Neutral ambient/key light replaces the green-blue cast; moving water alone has animated texture offsets.

### Visual evidence

The source comparison page now freezes the previous body in `src/character-model-v8-reference.js` and renders v8/v9 at the same scale and camera. Root inspected Jax standing, three-quarter/side full-charge crouch, Jax grab and Kai/Sidewalk Surf ordinary riding. Saved workspace-relative evidence: `outputs/breakline-v9-body-comparison.jpg`, `work/body-v9-crouch.jpg`, and `work/body-v9-grab.jpg`. A production ramp replay cleared the lip, returned to the bowl and landed safely (2.78 seconds of air, zero wipeouts).

This is an original interpretation with measurable posture improvements, not an exact reconstruction of the THPS2 models. Side-by-side screenshots judge likeness; numerical checks judge anatomy, coverage and animation contact. This pass remains local at the user's request.

## Expanded local reference comparison — 11 October 2026

The comparison now has ten selectable presets: grey crew three-quarter, tee lineup front, front T-pose, angled T-pose, relaxed front, grey crew selection, loose-trouser selection, rear riding, ramp grab, and the supplied snowboard tweaked-air reference. Eight additional original images are embedded locally, alongside the previous two. Their pixels are unmodified and their aspect ratios preserved. These reference assets are imported only by the review page.

Each preset sets a matching character/outfit, pose and approximate camera, with both old/current models sharing the same scale and view. Camera yaw, elevation and zoom remain adjustable, including left/right sides and rear three-quarter; Reset restores the preset. Notes call out the sleeve/costume mismatch in the angled T-pose, the raised manual arms in the rear shot, and the snowboard photo's different purpose. No exact recovered camera or identical costume is claimed.

An opt-in inspection T-pose was added identically to the v8 and current model builders. It activates only with standing:true and inspectionPose:'tpose'; existing production pose branches remain untouched. Model checks now pass 16/16, including 24 old/current inspection combinations, fixed limb lengths, horizontal arms, 640 real cloth seam vertices, exact restoration of default poses and ignored inspection input during riding.

This update changes the comparison tools, not the character body design, faces, gameplay rules or online project. The game/StackBlitz remains unpublished.

## Separate tee and sweatshirt checks — 14 October 2026

The navy/red/pink tee lineup (`8abb7f61...`) and grey tee T-pose (`d9f7d867...`) were inspected again for the latest body pass. They support a slimmer shoulder crest and less fabric bulk than the grey/yellow sweatshirt pair. The old sweatshirt envelope must not force every shirt to share that breadth. The standing and T-pose images also show why arm span, hanging elbows and the complete sleeve envelope cannot substitute for a horizontal garment slice at shoulder height.

`character-spec.js` now retains the existing **0.252–0.305H sweatshirt shoulder range**, and provides a separate **0.230–0.280H tee/shirt range**. These remain approximate art-direction guardrails inferred from the supplied poses, not measurements of a recovered THPS2 skeleton. The tee range has a lower maximum as well as a lower minimum; it does not globally relax the body audit. Anatomical shoulder spacing, head proportions, bone lengths, joint heights, chest checks and all cloth/contact tolerances remain unchanged.

The actual-model test uses the tee range for baggy tees, oversized tees, raglans and open/layered shirts; sweatshirt outfits explicitly use the original sweatshirt range. Bare shoulders and fitted wetsuits retain their separate treatment. Triangle-derived shoulder width is divided by measured crown-to-sole height and the character's intentional build factor. Negative controls ensure a slim tee cannot pass as a broad sweatshirt, an excessively broad shirt fails the tee check, and neither garment option permits a toy-sized head or shortened shins. Visual comparison from front, side, rear and riding angles is still required for approval.

## V10 body and riding silhouette — 14 October 2026

This pass responds to the rear comparison screenshot: wide feet, a low seated pelvis, rigid elbows and straight shorts. The previous production body is frozen in `character-model-v9-reference.js`. The comparison now renders V9 and V10 under identical lighting, camera and scale, retaining all ten supplied reference presets. The rear manual reference is explicitly compared with the new in-game rail balance pose; ordinary Riding remains selectable for a like-for-like neutral pose comparison. The rear camera is an estimated 145-degree three-quarter view, not a recovered original camera.

- Grounded ankle spacing is reduced from about 0.70 m to 0.59 m, and neutral hips rise about 8 cm. The board foot targets use the same narrower anchors during held grabs and special combos. Both legs retain their original physical lengths.
- Balance shifts the pelvis toward one leg, uses unequal knee bend directions, and raises bent arms with relaxed wrists. Player and rival grinds use a smoothed transition into the same pose. Ordinary riding has a separate lower arm pose checked from the side.
- Tees have a narrower shoulder/chest envelope than the retained roomy sweatshirts. An uneven hem, angled knee folds and longer tapered shorts cuffs alter the actual mesh. The first shorts section now starts at the sewn seat rather than the higher anatomical hip, eliminating the upward corner in a crouch.
- Dockside adds a faded navy tee and muted khaki cargo shorts so the supplied tee/riding references can be judged without a high-contrast tribal print obscuring the silhouette. This is also a selectable game outfit.
- The restored face and scalp geometry, UVs and material settings are compared against V9 for every character/outfit pairing. The head builder and face textures were not edited.

Rendered checks include the navy tee front, loose crew clothing in three-quarter view, ordinary riding in profile, rear rail balance and the ramp grab. Saved workspace-relative images: `work/body-v10-front-final.png` and `work/body-v10-rear-final.png`. These checks establish the visible changes above; they do not establish exact likeness to the unavailable original THPS2 mesh.

Validation covers 689 tests: an initial complete run followed by a passing 42-test recheck after updating the five stale pose/catalog fixtures. New checks measure 1,020 charge/balance poses, 29,760 sewn seam vertices, 624 upper-shorts surfaces and face/scalp preservation across all 68 character/outfit combinations. The old shorts-fin and photographic skin-protrusion defects are reproduced as negative controls; current held grabs and surfer specials retain actual deck contact. Build and standalone packaging also passed.
