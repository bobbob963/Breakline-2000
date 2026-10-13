// Shared by the production renderer and the rig regression tests. A grab has
// a deliberate reach, sustained contact, and release instead of a sine peak.
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

export const GRAB_HOLD_START = .22;
export const GRAB_HOLD_END = .80;

export function grabEnvelope(progress) {
  const t = clamp01(progress);
  if (t < GRAB_HOLD_START) return smooth(t / GRAB_HOLD_START);
  if (t <= GRAB_HOLD_END) return 1;
  return 1 - smooth((t - GRAB_HOLD_END) / (1 - GRAB_HOLD_END));
}

// Visual-only second-trick choreography. None of these values changes trick
// timing, accumulated rotations, score, launch physics or grab eligibility.
function comboChoreography(id, progress) {
  const weight=grabEnvelope(progress);
  if(weight===0)return null;
  const poses={
    crosswind:{hip:[-.055,.07,-.11],torso:[-.04,-.52,-.17],leftWrist:[-.62,.55,-.10],leftElbow:[-.42,.54,-.03],board:[-.48,.10,.16,.16,-.08]},
    flipcatch:{hip:[.025,.07,-.015],torso:[-.12,.08,-.06],leftWrist:[-.22,.59,-.36],leftElbow:[-.42,.45,-.19],board:[.10,.12,.12,0,.10]},
    decksweep:{hip:[-.10,.085,.09],torso:[-.08,.38,-.20],leftWrist:[-.46,.20,.29],leftElbow:[-.39,.36,.17],board:[.64,-.16,.22,-.31,.14]},
    coil360:{hip:[0,.10,-.04],torso:[-.10,.20,-.10],leftWrist:[-.145,.26,-.11],leftElbow:[-.32,.29,-.08],rightWrist:[.16,.23,-.14],tuck:.72,board:[-.12,-.08,.13,0,-.02]},
    crosscut:{hip:[.035,.045,-.075],torso:[-.035,.40,-.12],leftWrist:[-.55,.44,-.27],leftElbow:[-.44,.50,-.05],board:[.12,-.16,.02,.05,-.12]},
  };
  const pose=Object.hasOwn(poses,id)?poses[id]:null;
  if(!pose)return null;
  const board=pose.board.map(value=>value*weight);
  // The deck noses up into the catch, then settles underneath the hold. Both
  // parts have zero endpoint velocity, so this is a catch rather than a snap.
  if(id==='flipcatch')board[1]+=.34*smooth(progress/.14)*(1-smooth((progress-.14)/.22));
  return {id,weight,plantFeet:weight,hip:pose.hip.map(value=>value*weight),torso:pose.torso.map(value=>value*weight),leftWrist:pose.leftWrist,leftElbow:pose.leftElbow,rightWrist:pose.rightWrist,tuck:(pose.tuck||0)*weight,board};
}

// Signature moves share the ordinary contact solver but have their own body
// silhouettes. The cork rotates the complete rider/deck hierarchy, never a
// hand-held deck independently of the arm. All shape offsets ease back to zero.
function specialChoreography(id, progress) {
  const weight=grabEnvelope(progress);
  const poses={
    'tidal-rodeo':{hip:[-.03,.10,-.05],torso:[-.12,-.25,-.10],leftWrist:[-.40,.60,-.25],leftElbow:[-.38,.43,-.12],board:[-.25,.08,.15,.04,-.03]},
    'orbital-720':{hip:[-.04,.17,-.15],torso:[-.17,.15,.13],leftWrist:[-.14,.30,-.20],leftElbow:[-.40,.30,-.04],tuck:.8,board:[.26,-.18,.20,.10,-.06]},
    'reef-kickout':{hip:[-.07,.11,.10],torso:[.04,-.20,-.25],leftWrist:[-.53,.52,.24],leftElbow:[-.43,.62,.14],board:[.28,-.05,.09,-.08,.04]},
    'dockside-flip':{hip:[.05,.055,-.075],torso:[-.21,.42,-.10],leftWrist:[-.40,.17,-.35],leftElbow:[-.44,.38,-.12],tuck:.5,board:[-.10,.08,.06,.03,.02]},
  };
  const pose=Object.hasOwn(poses,id)?poses[id]:null;
  if(!pose)return null;
  // Jax lets the loose deck flip/shuv first, then pulls it into the catch.
  const plantFeet=id==='dockside-flip'?weight*smooth((progress-.20)/.08):weight;
  return {
    bodyRoll:id==='tidal-rodeo'&&progress<1?Math.PI*2*smooth(progress):0,
    bodyPitch:id==='tidal-rodeo'?Math.sin(Math.PI*smooth(progress))*.48:0,
    board:pose.board.map(value=>value*plantFeet),
    body:weight>0?{id,weight,plantFeet,hip:pose.hip.map(value=>value*weight),torso:pose.torso.map(value=>value*weight),leftWrist:pose.leftWrist,leftElbow:pose.leftElbow,tuck:(pose.tuck||0)*weight}:null,
  };
}

export function sampleRiderTrick(game, { air = !!game.airborne } = {}) {
  const result = {
    spin: air ? game.rotation || 0 : 0,
    flip: air ? game.flipRotation || 0 : 0,
    boardSpin: air ? game.boardRotation || 0 : 0,
    grab: 0, lipGrab: 0, tweak: 0, progress: 0, holdingGrab: false, comboPose:null,
    boardBank: 0, boardPitch: 0, boardLift: 0, boardSide: 0, boardBack: 0, bodyRoll:0, bodyPitch:0,
  };
  const trick = air ? game.trick : null;
  if (trick) {
    const progress = clamp01(trick.age / Math.max(.001, trick.duration));
    const bodyProgress = smooth(progress);
    const grabsBoard = trick.grab > 0;
    // Complete a combined flip/shuv before gripping the deck. Independent
    // board rotations during a full grab would twist the feet off the board.
    const boardProgress = grabsBoard ? smooth(progress / .20) : bodyProgress;
    result.spin += bodyProgress * (trick.spin || 0);
    result.flip += boardProgress * (trick.flip || 0);
    result.boardSpin += boardProgress * (trick.boardSpin || 0);
    result.grab = grabsBoard ? grabEnvelope(progress) : 0;
    result.tweak = trick.tweak > 0 ? grabEnvelope(progress) : 0;
    // This is a held, banked surfboard beside a tucked rider. B no longer
    // rotates the whole character through the old barrel-roll animation.
    result.boardBank = .90 * result.tweak;
    result.boardPitch = -.28 * result.tweak;
    result.boardLift = .27 * result.tweak;
    result.boardSide = -.37 * result.tweak;
    result.boardBack = .11 * result.tweak;
    const combo=comboChoreography(trick.comboAnimation,progress);
    if(combo){
      const {board,...body}=combo;result.comboPose=body;
      for(const [i,key]of ['boardBank','boardPitch','boardLift','boardSide','boardBack'].entries())result[key]+=board[i];
    }
    const special=specialChoreography(trick.specialId,progress);
    if(special){
      result.comboPose=special.body;
      result.bodyRoll=special.bodyRoll;result.bodyPitch=special.bodyPitch;
      for(const [i,key]of ['boardBank','boardPitch','boardLift','boardSide','boardBack'].entries())result[key]+=special.board[i];
    }
    result.progress = progress;
  }
  if (game.lipMove) {
    const progress = Number.isFinite(game.lipMove.progress)
      ? game.lipMove.progress
      : game.lipMove.age / Math.max(.001, game.lipMove.duration);
    result.lipGrab = grabEnvelope(progress);
  } else result.lipGrab = clamp01(game.lipGrab || 0);
  result.holdingGrab = result.grab === 1 || result.lipGrab === 1;
  return result;
}
