// Track selection is independent of ladder progress: free races never award
// ladder rewards and every venue remains available for practice.
export const TRACK_CHOICES=Object.freeze([
  Object.freeze({id:'park',name:'THE WATERWORKS',tag:'01 / FACTORY FREESTYLE',detail:'The original concrete park. Halfpipes, rust tunnels, coping and rails.',feature:'2 MINUTE SCORE SESSION',theme:'works'}),
  Object.freeze({id:'sewer-run',name:'RUNOFF RUN',tag:'02 / SEWER CIRCUIT',detail:'Amber-lit brick tunnels, broad pump rooms and a daylight outfall. Choose side-pipe shortcuts and outrun the flood.',feature:'RIVAL RACE / SHORTCUTS / 3 LIVES',theme:'runoff'}),
  Object.freeze({id:'sewer-depths',name:'THE DEEP WORKS',tag:'03 / PRESSURE CIRCUIT',detail:'Steel pressure mains, turbine vaults and a flooded spillway. Read the bends, dodge debris and cut through maintenance pipes.',feature:'RIVAL RACE / SHORTCUTS / 3 LIVES',theme:'depths'}),
]);

const pipeArt=theme=>`<div class="track-art track-art-${theme}" aria-hidden="true"><i></i><b></b><span>${theme==='works'?'//':'↓'}</span></div>`;

export function tracksMarkup(selected='park') {
  return `<p class="tracks-intro">Three places to hold your line. Pick a track for a session, or enter the sewer ladder for exclusive gear.</p><div class="track-grid">${TRACK_CHOICES.map(track=>`<button type="button" class="track-choice ${selected===track.id?'selected':''}" data-select-track="${track.id}" aria-pressed="${selected===track.id}">${pipeArt(track.theme)}<span class="track-card-copy"><small>${track.tag}</small><strong>${track.name}</strong><span>${track.detail}</span><em>${track.feature}</em><b>${selected===track.id?'SELECTED':'SELECT TRACK'} ↗</b></span></button>`).join('')}</div><section class="sewer-ladder-promo"><div><small>UNDERGROUND / FIVE RIVALS</small><h3>THE SEWER LADDER</h3><p>Race both sewer circuits. Win two outfits along the way, then unlock SLUDGE SURGE: an ability board with a speed burst and hazard shield.</p></div><button type="button" data-open-sewer-ladder>ENTER SEWER LADDER ↗</button></section><p class="tracks-help">Sun rings are mandatory. Shortcuts rejoin before the next ring. W pumps · A / D steer · Space hops debris · land tricks to boost.</p>`;
}

export function sewerLadderMarkup(progress,races,outfits) {
  return `<p class="rival-intro">Five head-to-head races beneath the city. Pass every sun ring and beat the rival. Three wipeouts end your run.</p><div class="sewer-prize-strip"><span>2 WINS<strong>${outfits.draincrew?.name||'DRAIN CREW'}</strong>OUTFIT</span><span>4 WINS<strong>${outfits.nightshift?.name||'NIGHT SHIFT'}</strong>OUTFIT</span><span>5 WINS<strong>SLUDGE SURGE</strong>ABILITY BOARD</span></div><ol class="rival-ladder sewer-ladder-list">${races.map((race,index)=>`<li class="${index<progress.completedRaces?'beaten':index===progress.completedRaces?'current':'locked'}"><b>${String(index+1).padStart(2,'0')}</b><div><strong>${race.rivalName}</strong><span>${race.trackId==='sewer-depths'?'THE DEEP WORKS':'RUNOFF RUN'}</span></div><div class="rival-target"><strong>${index<progress.completedRaces?'DEFEATED':index===progress.completedRaces?'NEXT UP':'LOCKED'}</strong></div></li>`).join('')}</ol><div class="ladder-reset-row"><button type="button" data-reset-sewer-ladder>RESET SEWER LADDER</button><p>Restart from race 1. Your unlocked outfits and board stay yours.</p></div>`;
}
