import test from 'node:test';
import assert from 'node:assert/strict';
import { SECRET_STORAGE_KEY, sanitizeSecretProgress, awardSurvivalSecret } from '../src/secret-progress.js';
import { rewardBoardUnlocked, getRewardBoard } from '../src/board-rewards.js';
import { validateProfile } from '../src/appearance.js';

const storm=elapsed=>({mode:'surf',rulesId:'storm',phase:'running',elapsed});
test('a single five-minute Survival run permanently discovers DEADTIME at the exact threshold',()=>{
  let progress=sanitizeSecretProgress(null);
  for(const elapsed of [0,60,120,180,299.999]){
    const result=awardSurvivalSecret(progress,storm(elapsed));assert.equal(result.unlocked,false);progress=result.progress;
  }
  const result=awardSurvivalSecret(progress,storm(300));assert.equal(result.unlocked,true);
  assert.equal(result.progress.deadtimeUnlocked,true);assert.equal(progress.deadtimeUnlocked,false);
  assert.equal(awardSurvivalSecret(result.progress,storm(420)).unlocked,false,'awarded once');
  assert.equal(rewardBoardUnlocked('deadtime',null,null,result.progress),true);
  assert.equal(validateProfile({rewardBoard:'deadtime'}).rewardBoard,'deadtime');
});
test('other modes, paused time, malformed timers and multiple shorter sessions cannot unlock the board',()=>{
  const locked=sanitizeSecretProgress(null);
  for(const game of [{...storm(600),rulesId:'surf'},{...storm(600),mode:'park'},{...storm(600),isRace:true},{...storm(600),isTimeTrial:true},{...storm(600),phase:'paused'},{...storm(600),phase:'ready'},...[-1,NaN,Infinity,'300',undefined].map(storm)])assert.equal(awardSurvivalSecret(locked,game).unlocked,false);
  let progress=locked;for(let run=0;run<6;run++)progress=awardSurvivalSecret(progress,storm(120)).progress;
  assert.equal(progress.deadtimeUnlocked,false);
  assert.equal(awardSurvivalSecret(locked,{...storm(300),phase:'finished'}).unlocked,true,'reaching five minutes on final frame still counts');
});
test('saved five-minute records migrate while strict unlock flags reject malformed saves',()=>{
  assert.equal(SECRET_STORAGE_KEY,'breakline99-secrets-v1');
  for(const best of [300,301.4,1800])assert.equal(sanitizeSecretProgress(null,best).deadtimeUnlocked,true);
  for(const best of [299.999,Infinity,NaN,'300',null])assert.equal(sanitizeSecretProgress(null,best).deadtimeUnlocked,false);
  for(const value of [null,{}, {deadtimeUnlocked:1},{deadtimeUnlocked:'true'},Object.create({deadtimeUnlocked:true})])assert.equal(sanitizeSecretProgress(value).deadtimeUnlocked,false);
  const saved=JSON.parse(JSON.stringify(sanitizeSecretProgress({deadtimeUnlocked:true})));
  assert.equal(sanitizeSecretProgress(saved,0).deadtimeUnlocked,true);
});
test('ladder and Time Trial completion alone cannot expose the hidden board',()=>{
  assert.equal(getRewardBoard('deadtime').hidden,true);assert.equal(getRewardBoard('deadtime').vfx,'clock');
  assert.equal(rewardBoardUnlocked('deadtime',{completedLadders:5},{completedTrials:12}),false);
  assert.equal(rewardBoardUnlocked('deadtime',null,null,{deadtimeUnlocked:'true'}),false);
});
