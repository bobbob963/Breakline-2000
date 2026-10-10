# Breakline '99 — character reference study

This is the earlier reference study. The current body revision and its direct image/mesh measurements are documented in **BODY-RESEARCH.md**. Version 7 restores the earlier painted faces at the user's request; historical comments about replacing them below describe the previous revision.

Prepared 9 October 2026. The objective is an original adult-human character with the silhouette, clothing and textured low-polygon readability of the supplied late-1990s skating references. No proprietary mesh, texture, face, logo or animation has been extracted.

## What the evidence supports

Jamie Fristrom's first-person development postmortem describes the **first Tony Hawk game's Dreamcast port**, not THPS2's exact PlayStation asset budget. His team tripled the skater polygon counts with little apparent improvement, while making joint defects more obvious. They could not change shoulder structure or pivot placement because they retained the original PlayStation animations. He also describes Lightwave 5.6 and a modified Neversoft export plugin. The useful lesson is that silhouette, texture placement and deformation deserve priority over adding polygons. [Developer postmortem, 28 June 2000](https://www.gamedeveloper.com/design/postmortem-treyarch-s-i-tony-hawk-s-pro-skater-i-dreamcast-version-)

In 2003, Hawk described face/clothing/board photography for texture maps and video animation references; this is later-series evidence, not a THPS2-specific specification. [First-person interview](https://www.theguardian.com/technology/2003/jan/09/interviews.onlinesupplement)

A contemporary reverse-engineer's first-hand examination of **THPS2's PC port** describes Neversoft's transformation/ordering pipeline, modified PlayStation GPU commands, and higher-resolution Dreamcast texture material. Different ports therefore cannot be assumed to have identical rendering or texture detail. This source is implementation research by the mod author, not testimony from the original art team. [PARTYMOD renderer write-up](https://partymod.newnet.city/writeups/1.html)

No verified original THPS2 PlayStation character polygon count, exact atlas resolution, skeleton measurements or asset-authoring specification was established in this research. The project should not label arbitrary modern limits as official historical figures. The supplied pictures also do not establish which version produced each render.

## Reading the supplied references

The 234 × 256 character-selection picture and 480 × 416 gray/yellow character picture are posed, perspective views. Measurements below are manual estimates of visible silhouettes, with uncertainty from pose, lighting and a few pixels of edge ambiguity. They are useful art-direction targets, not recovered original mesh dimensions.

For comparison, take visible crown-to-lowest-sole height as **H**. A hat adds uncertainty to the crown; a crouch reduces projected standing height. Do not compare a crouched game pose directly with these standing ratios.

| Feature | Working target | Why it matters |
|---|---:|---|
| Head height, crown to chin | 0.125–0.140 H | Roughly 7.1–8 heads tall; adult proportions |
| Head width | 0.077–0.097 H | Avoid round toy heads and narrow featureless columns |
| Outer garment width across shoulder area | 0.265–0.300 H | Exclude hanging elbows and hands from this width |
| Chest garment width | 0.220–0.275 H | Loose clothing with a shaped chest and sloping shoulders |
| Hip garment width | 0.190–0.250 H | Distinct pelvis; shirt overlaps waistband |
| Shoulder joint height above soles | 0.790–0.835 H | Short exposed neck, recognisable trapezius |
| Relaxed wrist height above soles | 0.430–0.510 H | Arms long enough to read naturally |
| Baggy shirt hem height | 0.490–0.555 H | Hip-length shirt, not a cropped box |
| Hip joint height | 0.500–0.560 H | Skeletal landmark hidden beneath clothing |
| Visible loose trouser crotch | 0.370–0.440 H | Lower than anatomical hips; estimate has low confidence |
| Knee joint height | 0.255–0.315 H | Prevent short shins and exaggerated upper legs |
| Shoulder–elbow / elbow–wrist length | 0.165–0.200 / 0.140–0.180 H | Measure actual joint distances, not screen-space projection |
| Hand length, wrist to fingertips | 0.080–0.108 H | Flat mitten shape with thumb; not a spherical knob |
| One baggy trouser cuff width | 0.090–0.130 H | Broad cuffs reach the shoes |
| Cuff width / knee garment width | Approximately 0.65–0.95 | Avoid narrow ankles under huge spherical knees |

The executable limits in `breakline-99/src/character-spec.js` allow slightly wider tolerances than this table because characters and outfits vary. Bare arms, shorts and fitted wetsuits should not be judged by sweatshirt/trouser dimensions.

## Candid assessment of the v4 Jax screenshot

The current reference screenshot is `breakline-v4-jax.jpg`. Its head-to-body ratio is already approximately 7.4–7.7; simply shrinking or enlarging the whole head will not solve the problem. The shoulder/upper-arm silhouette is roughly 0.30–0.33 H, versus roughly 0.26–0.29 in the supplied pictures, depending on the exact crop and shoulder edge chosen.

The larger problem is construction. The shoulders are too square and level, the chest is a nearly constant-section tube, and the sleeves swell into separate upper/lower-arm lobes. The face has little visible cheek, nose, eyelid or jaw information. Long dark shapes around the head obscure its connection to the neck. The resulting figure reads as a dressed mannequin even though its overall height proportions are reasonable.

The references instead show a sloping shoulder line, an irregular shirt hem, cloth folds with broad light and dark regions, a clear face with nose and cheek planes, and small asymmetries in the stance. The gray trousers have one continuous loose silhouette down to the shoes. These properties should be authored into geometry and texture rather than simulated with random grit.

The upright surfboard is intentionally larger than the reference skateboard, because the requested game uses surfboards. Its relative size should not be treated as a character-scale error.

## Checks that can expose regressions

1. Measure actual standing-model landmark positions and transformed mesh vertices. Derive H from crown and sole positions; do not read a self-declared `height: 1.8` field and call that validation.
2. Measure both anatomical shoulder pivots and outer garment edges. Correct joint spacing can coexist with oversized sleeves.
3. Compare front, three-quarter, side and rear views with neutral lighting and a plain background, plus the final camera and pixel resolution. Check shape before judging texture.
4. Test standing, full crouch, grab, full lean and airborne poses. Check all position data for non-finite values; inspect cloth across elbows/knees and foot contact with the board.
5. Downsample the head to about 30 pixels high. Brow, eyes, nose, cheeks, mouth and jaw should still form a face. A high-resolution atlas alone does not establish this.
6. Keep a rendered comparison of gray crew and yellow crew outfits. Ensure the art changes color and cloth detail without changing the adult silhouette or introducing texture seams.

`character-spec.js` provides independent measuring functions and a ratio audit. `character-proportions.test.js` deliberately tests malformed heads, broad shoulders, shortened shins, skinny cuffs, missing evidence and non-finite geometry. These are tests of the measurement tools; they are **not** a claim that the game's new character has passed until actual generated geometry is supplied to the audit. A numerical pass is necessary evidence for proportions, but visual comparison remains necessary for the face, silhouette, clothing and animation.

## Verified measurements of the new model

The new `character-model.test.js` now measures actual generated mesh vertices and triangle intersections for all 48 character/outfit combinations. It uses an empty canvas implementation only to permit the geometry checks to run outside a browser; texture appearance is not tested by that substitute.

| Actual generated quantity | Observed range |
|---|---:|
| Visible standing height, including hats and shoes | 1.7833–1.8155 m |
| Painted face-mesh height / visible standing height | 0.1255–0.1277 |
| Garment shoulder slice / measured crown-to-sole height, baggy outfits | 0.2571–0.2731 |
| Raised-arm upper segment / forearm, Jax | 0.320 / 0.290 m |
| Jax thigh / shin through riding and grabs | 0.478 / 0.450 m |
| Full-grab fingertip to exposed board-rail target | Under 0.003 m in the test; observed exact contact to displayed precision |

The face-mesh extent is explicitly different from the entire head-with-hat or head-with-dreadlocks bounding box. Garment breadth checks allow the original characters' intentional build differences; fitted wetsuits and bare shoulders are not required to match a baggy sweatshirt.

Cross-pose measurement exposed a genuine initial defect: a raised upper arm shrank by about 43%, and a crouched thigh shrank by about 39%. The subsequent two-bone rig correction removed that telescoping. The regression now requires each limb segment to remain within 3% of its standing length. Actual Jax readings hold arms at 0.320/0.290 m and thighs at 0.478 m; the standing shin differs from riding by about 1 mm.

At this checkpoint, all 48 standing silhouettes pass the geometric audit, all 432 combinations of model and demanding pose retain finite geometry/normals, and all 144 tested full grabs/lip grabs place actual hand geometry within 3 mm of the declared rail-contact target. These tests verify the character rig and the contact target; a separate game render must confirm that the target and animated board coincide. They do not establish an exact reproduction of THPS2 art or replace visual approval.


## Texture provenance and visual review

The eight-tile atlas is original art generated with the built-in image-generation tool. Four fictional adult faces occupy its top row; sweatshirt front, denim leg, sweatshirt back and sleeve patches occupy the bottom. The runtime samples 128-pixel face maps and 256 × 128 front/back clothing maps with nearest magnification. Outfit colours are applied with soft-light compositing, preserving folds without making every outfit dark. The original atlas is `character-texture-atlas.png`; its embedded copy is `src/rider-atlas.js`. No game texture was extracted or included in gameplay.

The supplied reference appears beside the real model in `model-lab.html`. The final visual review covers standing front, three-quarter and back views, plus crouch and a full board grab; the lab also exposes the side view and every outfit. The old inflated sleeve joints and rounded pelvis cap were replaced with tapered continuous sleeves and flat trouser panels. The head and face were checked at both selection-menu scale and neutral review scale. The reference and new model remain distinguishable; this is a measured stylistic reconstruction, not an exact recovered THPS2 character.

The production `ride-lab.html` drives the actual game simulation with held controls. It stops at pipe-wall and ceiling positions, a completed loop, the lip-grab turn, and direct coping entry, allowing the real character, board, collision surface and camera to be inspected together.
