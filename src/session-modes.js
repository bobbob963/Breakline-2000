// Shared simulation/rendering contract. Every collidable reef comes from the
// same course descriptor consumed by the scene; storm has no invisible hits.
export const SURF_RULES=Object.freeze({
  surf:Object.freeze({id:'surf',name:'SURF SESSION',startTime:120,duration:120,spacing:64,firstGate:70,checkpointBonus:0,targetGates:0,startingLives:null,ringRadius:2.35,hazardRadius:2.6,hazardOffset:30,currentStrength:1,normalSpeed:19,pumpSpeed:26,brakeSpeed:9,landingTolerance:9}),
  rush:Object.freeze({id:'rush',name:'REEF RUSH',startTime:35,duration:null,spacing:90,firstGate:75,checkpointBonus:8,targetGates:12,startingLives:null,ringRadius:2.25,hazardRadius:2.6,hazardOffset:42,currentStrength:1.15,normalSpeed:22,pumpSpeed:29,brakeSpeed:10,landingTolerance:9}),
  storm:Object.freeze({id:'storm',name:'STORM SURVIVAL',startTime:0,duration:null,endless:true,spacing:48,firstGate:60,checkpointBonus:0,targetGates:0,startingLives:3,ringRadius:2.3,hazardRadius:3,hazardOffset:23,currentStrength:2,normalSpeed:22,pumpSpeed:29,brakeSpeed:9,landingTolerance:9.5}),
});

export function surfRules(id='surf') {return SURF_RULES[Object.hasOwn(SURF_RULES,id)?id:'surf'];}
