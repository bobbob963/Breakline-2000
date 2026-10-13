// This guide describes the same controls and progression used by the game.
// Keep the content separate from the dialog so it can be checked against rules.
export const TUTORIAL_STEPS = Object.freeze([
  {
    id: 'welcome', chapter: 'START HERE', title: 'WELCOME TO THE BREAK.',
    lead: 'Find your line. Earn your air. Make the landing count.',
    cards: [
      { title: 'LEARN THE RIDE', text: 'Carve, pop and link tricks. The controls carry from the open wave into the factory.' },
      { title: 'PICK YOUR SESSION', text: 'Chase a score, survive the storm or race the crew through sun rings.' },
      { title: 'BUILD YOUR SETUP', text: 'Win boards and outfits, then put your name above your rider in the lobby.' },
    ],
    note: 'A quick guide before your first ride. You can move back through the chapters at any time.',
  },
  {
    id: 'movement', chapter: 'MOVEMENT', title: 'HOLD YOUR LINE.',
    lead: 'Steer across the wave, build speed and leave room to land.',
    controls: [
      { keys: ['A / D'], label: 'Carve left / right', detail: 'Left and right arrows work too. The high wave lip is on the left.' },
      { keys: ['W'], label: 'Pump for speed', detail: 'The up arrow also pumps. Carry speed into your next move.' },
      { keys: ['S'], label: 'Brake / settle', detail: 'The down arrow also slows you. Use it to control a rough approach.' },
    ],
    note: 'P or Esc pauses. R restarts your run. M switches sound on or off. Hover over the top edge for the radio: choose any song, Shuffle, or Auto for session music. Its ? knob opens the full key guide.',
  },
  {
    id: 'air', chapter: 'AIR + CUTBACKS', title: 'EARN YOUR AIR.',
    lead: 'A good launch gives you time to finish your trick.',
    controls: [
      { keys: ['SPACE'], label: 'Hold, then release to pop', detail: 'Hold to load the jump. Release to take off. Check the pop recovery meter before jumping again.' },
      { keys: ['SHIFT', 'A / D'], label: 'Snap a cutback', detail: 'Turn while holding Shift. Release and turn again for another cutback. C also works.' },
    ],
    cards: [
      { title: 'WAVE LIP → POP', text: 'Reach the high lip with speed, or finish a cutback, then pop for trick height.' },
      { title: 'FLAT HOP', text: 'A low hop clears driftwood in Survival. Ordinary flat hops in Surf Session and Survival earn no trick points or boost.' },
    ],
    note: 'All modes have a pop cooldown. Race pops give enough height for a basic trick, so you can earn a boost from the course.',
  },
  {
    id: 'tricks', chapter: 'TRICKS + COMBOS', title: 'LINK IT. LAND IT.',
    lead: 'Press a trick key in the air. Let one move finish before starting the next.',
    controls: [
      { keys: ['J'], label: '180 spin' }, { keys: ['K'], label: 'Kickflip' }, { keys: ['L'], label: 'Indy grab' },
      { keys: ['U'], label: 'Shuv-it' }, { keys: ['O'], label: 'Heelflip' }, { keys: ['H'], label: 'Method air' },
      { keys: ['F'], label: '360 air' }, { keys: ['B'], label: 'Tweaked grab' }, { keys: ['I'], label: '100% Special' },
    ],
    cards: [
      { title: 'COMBO → BOOST', text: 'Surf Session, Survival, Waterworks and races reward landed tricks with speed bursts. Link more before banking for stronger boosts. Try J, wait for the spin, then B for a custom combo animation.' },
      { title: 'BANK YOUR POINTS', text: 'Enter banks a landed combo. Pop again before its meter empties to keep linking. An unfinished trick can cause a wipeout and lose the combo.' },
    ],
    note: 'Each surfer has a signature special: Kai has Tidal Rodeo, Nova has Orbital 720, Reef has Reef Kickout, and Jax has Dockside Flip. A full Special meter stays at 100% until you use I in the air. Give each trick enough time to land.',
  },
  {
    id: 'surf', chapter: 'SURF SESSION', title: 'CHASE THE PERFECT LINE.',
    lead: 'Two minutes on the wave. Build a score through clean tricks and flowing combos.',
    cards: [
      { title: 'READ THE WATER', text: 'Use the wave lip and cutbacks for air. Catch sun rings and steer around visible reefs.' },
      { title: 'LAND FOR SPEED', text: 'A completed lip or cutback trick gives an automatic boost. Link a combo for a stronger, longer burst; no extra boost key.' },
      { title: 'A DIFFERENT SKY', text: 'Each new Surf Session picks dawn, midday, sunset or dusk. Sunset has its own chilled soundtrack. Surf Session is never stormy.' },
      { title: 'REEF RUSH', text: 'Want a checkpoint challenge? Catch 12 sun rings before the clock runs out. Each ring adds eight seconds.' },
    ],
    note: 'Whirlpools and driftwood belong to Survival. Surf Session keeps the focus on your line, score and landing.',
  },
  {
    id: 'survival', chapter: 'STORM SURVIVAL', title: 'OUTRUN THE COLLAPSE.',
    lead: 'Always a storm. Three lives. No time limit. The longer you last, the harder it gets.',
    cards: [
      { title: 'THROUGH THE BARREL', text: 'Line up with the hollow curl. Watch the countdown, pump with W and carry trick boosts through before the wave shuts.' },
      { title: 'THE STORM BUILDS', text: 'Later reef banks funnel you into barrels. Their escape window gets shorter, down to 1.3 seconds. Set up your boost on the approach.' },
      { title: 'WATCH THE SURFACE', text: 'Tap and release Space to hop driftwood, or steer around it. Stay clear of the dark centre of a whirlpool.' },
      { title: 'FIVE MINUTES → DEADTIME', text: 'Survive five minutes to unlock the secret board. Equip it and Q toggles slow motion. Spend its full charge for +50% speed for three seconds.' },
    ],
    note: 'Your third wipeout ends the run. DEADTIME has six seconds of charge and recharges in twelve seconds of active play.',
  },
  {
    id: 'waterworks', chapter: 'THE WATERWORKS', title: 'TAKE IT TO CONCRETE.',
    lead: 'Ride the factory basins, rusty tunnels, ramps and rails with the same trick keys.',
    controls: [
      { keys: ['E', 'A / D'], label: 'Loop the pipes', detail: 'Hold E inside a tunnel and steer around its walls. Release E to return to the floor.' },
      { keys: ['E'], label: 'Grab the lip', detail: 'Hold E as you reach a quarterpipe lip to grab your board and turn back into the ramp.' },
      { keys: ['SHIFT'], label: 'Catch the coping', detail: 'Hold Shift as you ride to the ramp top to grind without jumping. A / D chooses your direction.' },
    ],
    note: 'Ride ramps for bigger air. Land tricks for boosts. Jump onto rails along their length to grind; Space pops you off. Shift + turn still makes a sharp cutback away from the coping.',
  },
  {
    id: 'rivals', chapter: 'THE HIT LIST', title: 'BEAT THE WHOLE CREW.',
    lead: 'Five rival ladders. Five races per ladder. Coast runs and Waterworks circuits.',
    cards: [
      { title: 'EVERY SUN RING. IN ORDER.', text: 'Pass through each gold ring, then reach the finish before your rival. Flying over or skipping a ring does not count. Follow the factory route map.' },
      { title: 'TRICKS ARE YOUR ENGINE', text: 'Land a trick for a boost and link a combo for more speed. Your rival does tricks and earns boosts too. Brake to ease off; wiping out clears your boost.' },
      { title: 'WIN A PRIZE BOARD', text: 'Finish each ladder to unlock a new board, with its own perk and trick effects. Equip it in Customise Board to use it.' },
      { title: 'RUN IT AGAIN', text: 'Reset a ladder whenever you want to race it again. The boards and ladder completions you have already earned stay unlocked.' },
    ],
    note: 'A simple start: hold Space briefly, release, press J, then land. Charge longer and add another finished trick when you have enough air.',
  },
  {
    id: 'time-trials', chapter: 'TIME TRIALS', title: 'YOU AGAINST THE CLOCK.',
    lead: 'Clear all five rival ladders to open the Time Trials.',
    cards: [
      { title: 'TWELVE ROUTES', text: 'Ten wave runs and two extended Waterworks circuits. Clear every sun ring and beat the target time. Each new route asks more of your riding.' },
      { title: 'KEEP YOUR MOMENTUM', text: 'Use landed tricks and combos for boosts. Missing an ocean checkpoint ends the attempt. The clock stops when you pause.' },
      { title: 'THREE CLEARS → REWARDS', text: 'Every three new route clears unlock another outfit and board style. Repeating a cleared route improves your best time; it does not count as a new clear.' },
      { title: 'FIRST THREE → AFTERBURNER', text: 'Complete your first three Time Trials to earn a board with +25% base speed and +50% bonus boost power.' },
    ],
    note: 'Unlocks are saved in this browser. Your character, outfit and board can be changed before the next attempt.',
  },
  {
    id: 'customise', chapter: 'YOUR SETUP', title: 'MAKE IT YOURS.',
    lead: 'Choose your rider in the lobby, then dress and equip them for the next session.',
    cards: [
      { title: 'SELECT SURFER', text: 'Use the character button beside your lobby rider. Compare riders and their stats, rotate the preview with X / C, and accept your choice.' },
      { title: 'SELECT OUTFIT', text: 'Use the gold Select Outfit button beside your lobby rider to open the wardrobe directly. You can also open it from character selection. Time Trial clothes appear here as you earn them.' },
      { title: 'CUSTOMISE BOARD', text: 'Choose paint and deck graphics, or equip an unlocked prize board. The active prize board supplies the perk and trick effects; perks do not stack.' },
      { title: 'BOARD POWERS', text: 'SKYBOUND opens angel wings on descent. After a trick finishes, press and release Space for one extra air jump. Land to recharge it. DEADTIME uses Q.' },
    ],
    note: 'Next, choose the name that floats above your rider in the lobby. You can replay this guide from the Admin panel.',
  },
  {
    id: 'name', chapter: 'YOUR RIDER NAME', title: 'WHAT DO WE CALL YOU?',
    lead: 'Give your rider a name. It appears above their head in the lobby.',
    note: 'Up to 20 characters. Your rider name and tutorial completion are saved on this browser.',
  },
].map(step => Object.freeze({ ...step, cards: step.cards && Object.freeze(step.cards.map(Object.freeze)), controls: step.controls && Object.freeze(step.controls.map(control => Object.freeze({ ...control, keys: Object.freeze(control.keys) }))) })));
