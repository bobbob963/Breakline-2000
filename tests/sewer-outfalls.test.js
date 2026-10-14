import test from 'node:test';
import assert from 'node:assert/strict';
import {createSewerCourse,sewerWaterHeight} from '../src/sewer-course.js';
import {createSewerOutfalls,sewerOutfallSites} from '../src/sewer-outfalls.js';
const style={water:0x476348,foam:0xd1cf8c,rust:0x826036,light:0xffdc6e,fog:0x484525};

for(const trackId of ['sewer-run','sewer-depths']){
  test(`${trackId} outflow pipes pour into the animated water and reuse their geometry`,()=>{
    const course=createSewerCourse(trackId),outfalls=createSewerOutfalls(course,trackId,style),sites=sewerOutfallSites(course);
    assert.ok(sites.length>=4,'waterfalls recur throughout the course');
    const geometries=[];outfalls.group.traverse(o=>{if(o.geometry)geometries.push(o.geometry);});
    for(const outlet of outfalls.outlets){
      assert.ok(outlet.height>10,'solid pipe hardware clears normal jumps');
      assert.ok(Math.abs(outlet.impactX)<course.halfWidth,'fall lands in the channel');
      for(const time of [0,.8,2.2,7.5]){
        outfalls.update(time,outlet.distance);
        const water=sewerWaterHeight(outlet.impactX,outlet.distance,time,trackId),geometry=outlet.pour.geometry;
        const last=geometry.userData.rows*(geometry.userData.sides+1);
        for(let i=last;i<geometry.attributes.position.count;i++)assert.ok(Math.abs(geometry.attributes.position.getY(i)-water)<1e-5,'stream ends at the animated surface, without a hovering gap');
        assert.ok(Math.abs(outlet.splash.position.y-water-.035)<1e-6);
        assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
      }
    }
    const after=[];outfalls.group.traverse(o=>{if(o.geometry)after.push(o.geometry);});assert.deepEqual(after,geometries);
    outfalls.update(10,course.length+400);assert.ok(outfalls.outlets.every(item=>!item.unit.visible),'distant waterfall animation is culled');
  });
}
