import { ArcadeAudio, MENU_BPM, MENU_TRACK, RACE_BPM, RACE_TRACK, SUNSET_BPM, SUNSET_TRACK, SURVIVAL_BPM, SURVIVAL_TRACK } from './audio.js';

const $ = id => document.getElementById(id);
const SAMPLE_RATE = 48000, BARS = 8, START = .04, TAIL = 1.1;
let audioURL=null,wavBlob=null,filename='Afterhours-Yard-Circuit.wav',rendering=false;
const db = value => value>0 ? 20*Math.log10(value) : -Infinity;
const showDB = value => Number.isFinite(value) ? `${value.toFixed(1)} dBFS` : '−∞ dBFS';

function buildProductionGraph(context,scene) {
  const synth=new ArcadeAudio();
  if(scene==='sunset'||scene==='survival')synth.setRideContext({mode:'surf',rulesId:scene==='survival'?'storm':'surf',weatherId:'sunset'});
  synth.setScene(scene);
  // Use the production signal graph with a real offline browser context.
  // No mocked nodes, global constructor replacements or normalisation.
  synth._build(context);
  return synth;
}

function releaseGraph(synth) {
  if(!synth)return;
  synth._clearWastedVoices();
  for(const source of synth._persistentSources){try{source.stop();}catch{/* Rendering may already have ended. */}}
  for(const node of synth._persistent){try{node.disconnect();}catch{/* Already disconnected. */}}
  // OfflineAudioContext has no close(); dropping these retained nodes/buffers
  // releases the graph while preserving only the rendered result for playback.
  synth.voices.clear();synth._strings.clear();synth._persistent=[];synth._persistentSources=[];synth.ctx=null;
}

function analyse(buffer,musicalDuration) {
  const from=Math.floor(START*buffer.sampleRate),to=Math.min(buffer.length,Math.floor((START+musicalDuration)*buffer.sampleRate));
  const channels=[];let totalSquares=0,peak=0,fullScale=0,invalid=0;
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const data=buffer.getChannelData(channel);let channelPeak=0,squares=0,nearFullScale=0;
    for(let i=0;i<data.length;i++){
      const sample=data[i];
      if(!Number.isFinite(sample)){invalid++;continue;}
      channelPeak=Math.max(channelPeak,Math.abs(sample));
      if(Math.abs(sample)>=.999)nearFullScale++;
      if(i>=from&&i<to)squares+=sample*sample;
    }
    channels.push({peak:channelPeak,rms:Math.sqrt(squares/(to-from)),nearFullScale});
    peak=Math.max(peak,channelPeak);totalSquares+=squares;fullScale+=nearFullScale;
  }
  return{channels,peak,rms:Math.sqrt(totalSquares/((to-from)*buffer.numberOfChannels)),fullScale,invalid};
}

function wav(buffer) {
  const channels=buffer.numberOfChannels,bytes=buffer.length*channels*2;
  const bytesOut=new ArrayBuffer(44+bytes),view=new DataView(bytesOut);
  const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+bytes,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);
  view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);
  text(36,'data');view.setUint32(40,bytes,true);
  const data=Array.from({length:channels},(_,index)=>buffer.getChannelData(index));let offset=44;
  for(let frame=0;frame<buffer.length;frame++)for(let channel=0;channel<channels;channel++){
    const sample=Math.max(-1,Math.min(1,data[channel][frame]));
    view.setInt16(offset,Math.round(sample*(sample<0?32768:32767)),true);offset+=2;
  }
  return new Blob([bytesOut],{type:'audio/wav'});
}

function drawWaveform(buffer) {
  const canvas=$('waveform'),ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
  ctx.fillStyle='#162822';ctx.fillRect(0,0,width,height);ctx.strokeStyle='#405b4b';ctx.lineWidth=1;
  for(const y of [height*.25,height*.5,height*.75]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
  for(let channel=0;channel<2;channel++){
    const data=buffer.getChannelData(channel),mid=height*(channel?.75:.25),scale=height*.21;
    ctx.strokeStyle=channel?'#6ca993':'#dfbb70';ctx.beginPath();
    for(let x=0;x<width;x++){
      const from=Math.floor(x/width*data.length),to=Math.max(from+1,Math.floor((x+1)/width*data.length));
      let low=0,high=0;for(let i=from;i<to;i++){low=Math.min(low,data[i]);high=Math.max(high,data[i]);}
      ctx.moveTo(x,mid-high*scale);ctx.lineTo(x,mid-low*scale);
    }
    ctx.stroke();
  }
}

async function renderSection() {
  if(rendering)return;rendering=true;
  for(const id of ['render','track','section','intensity'])$(id).disabled=true;
  $('player').pause();$('status').className='status';$('status').textContent='Rendering the production synth through Web Audio…';
  let synth;
  try{
    // Yield a frame so the working state paints before sample generation.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
    if(!Offline)throw new Error('This browser does not support OfflineAudioContext. Open the lab in Edge or Chrome.');
    const scene=$('track').value,race=scene==='race',survival=scene==='survival',wasted=scene==='wasted';
    const bpm={race:RACE_BPM,menu:MENU_BPM,sunset:SUNSET_BPM,survival:SURVIVAL_BPM}[scene];
    const title={race:RACE_TRACK,menu:MENU_TRACK,sunset:SUNSET_TRACK,survival:SURVIVAL_TRACK,wasted:'Wasted / Final Wipeout'}[scene];
    const bar=Number($('section').value),musicalDuration=wasted?3.6:BARS*4*60/bpm;
    const context=new Offline(2,Math.ceil((START+musicalDuration+TAIL)*SAMPLE_RATE),SAMPLE_RATE);
    const began=performance.now();synth=buildProductionGraph(context,scene);
    synth.enabled=true;synth.active=true;synth._fade(true);
    const intensity=$('intensity').value;
    synth.setRaceState({progress:intensity==='final'?.9:.3,boost:intensity==='boost'||intensity==='final'?1:0});
    if(survival)synth.setRideContext({mode:'surf',rulesId:'storm',elapsed:intensity==='final'?240:intensity==='boost'?150:0});
    if(wasted){synth.startWastedSequence();synth._scheduleWastedReveal(1.85);}
    for(let step=0;!wasted&&step<BARS*16;step++){
      const scoreStep=(bar*16+step)%(32*16);synth.beat=scoreStep;
      if(race)synth._scheduleRaceStep(scoreStep,START+step*60/bpm/4);
      else if(scene==='sunset')synth._scheduleSunsetStep(scoreStep,START+step*60/bpm/4);
      else if(survival)synth._scheduleSurvivalStep(scoreStep,START+step*60/bpm/4);
      else synth._scheduleMenuStep(scoreStep,START+step*60/bpm/4);
    }
    const buffer=await context.startRendering(),metrics=analyse(buffer,musicalDuration);
    if(metrics.invalid)throw new Error(`The synth produced ${metrics.invalid} non-finite samples.`);
    if(metrics.peak===0)throw new Error('The rendered mix is silent.');
    const nextBlob=wav(buffer),nextURL=URL.createObjectURL(nextBlob);
    if(audioURL)URL.revokeObjectURL(audioURL);audioURL=nextURL;wavBlob=nextBlob;
    filename=wasted?'Wasted-Final-Wipeout.wav':`${title.replace(/[^a-z0-9]+/gi,'-')}-bars-${bar+1}-${bar+BARS}${race||survival?`-${intensity}`:''}.wav`;
    $('player').src=audioURL;$('result').classList.add('visible');
    $('render-label').textContent=wasted?`${title} · descending rush and heartbeats · title impact at 1.85 s · natural decay`:`${title} · bars ${bar+1}–${bar+BARS} · ${bpm} BPM${race||survival?` · ${intensity} mix`:''} · ${musicalDuration.toFixed(2)} s of music + natural tail`;
    $('stats').innerHTML=[['Sample peak',showDB(db(metrics.peak)),metrics.peak.toFixed(4)],['Musical RMS',showDB(db(metrics.rms)),'Unnormalised mix'],['Crest factor',`${(db(metrics.peak)-db(metrics.rms)).toFixed(1)} dB`,'Peak minus RMS'],['Full-scale samples',metrics.fullScale.toLocaleString(),'Threshold: |sample| ≥ 0.999']].map(([label,value,note])=>`<div class="stat">${label}<strong>${value}</strong><small>${note}</small></div>`).join('');
    $('verdict').textContent=metrics.fullScale===0?`No samples reached digital full scale. Measured peak headroom: ${(-db(metrics.peak)).toFixed(1)} dB. Guitar saturation is intentional; listen for mix balance and unwanted noise.`:'Full-scale samples were detected. Listen carefully for unintended clipping before accepting this mix.';
    $('channels').innerHTML=`<table><thead><tr><th>Channel</th><th>Peak</th><th>RMS</th><th>Full-scale samples</th></tr></thead><tbody>${metrics.channels.map((c,i)=>`<tr><td>${i?'Right':'Left'}</td><td>${showDB(db(c.peak))}</td><td>${showDB(db(c.rms))}</td><td>${c.nearFullScale}</td></tr>`).join('')}</tbody></table>`;
    drawWaveform(buffer);$('status').textContent=`Render complete in ${((performance.now()-began)/1000).toFixed(2)} s. Press Play rendered audio to listen, or export the measured WAV.`;
  }catch(error){$('status').className='status error';$('status').textContent=`Render failed: ${error.message||error}`;console.error(error);}
  finally{releaseGraph(synth);rendering=false;for(const id of ['render','track','section'])$(id).disabled=false;updateLayers();}
}

function updateLayers(){
  const survival=$('track').value==='survival';
  $('section').disabled=$('track').value==='wasted';
  $('render').textContent=$('track').value==='wasted'?'RENDER FINAL WIPEOUT':'RENDER 8 BARS';
  $('intensity').disabled=!['race','survival'].includes($('track').value);
  const labels=survival?['Storm opening','Two minutes / rising urgency','Four minutes / full urgency']:['Normal racing','Combo boost','Final stretch + boost'];
  [...$('intensity').options].forEach((option,index)=>{option.textContent=labels[index];});
}
$('track').addEventListener('change',updateLayers);
$('render').addEventListener('click',renderSection);
$('play').addEventListener('click',async()=>{try{$('player').currentTime=0;await $('player').play();}catch(error){$('status').textContent=`Playback could not start: ${error.message||error}`;}});
$('export').addEventListener('click',()=>{if(!wavBlob||!audioURL)return;const link=document.createElement('a');link.href=audioURL;link.download=filename;link.click();});
window.addEventListener('pagehide',()=>{if(audioURL)URL.revokeObjectURL(audioURL);},{once:true});
