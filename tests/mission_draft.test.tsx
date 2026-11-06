import {afterEach,expect,it} from 'vitest';
import {readMissionDraft,saveMissionDraft} from '../frontend/src/universe/missionDraft';
afterEach(()=>sessionStorage.clear());
it('isolates planet drafts and ignores corrupt browser data',()=>{
 saveMissionDraft('home',{ids:['ship'],mission:'TRANSPORT',target:'colony',x:1,y:2,index:0,resource:'raw_ore',amount:7});
 expect(readMissionDraft('home').ids).toEqual(['ship']);expect(readMissionDraft('other')).toEqual({});
 sessionStorage.setItem('starz.mission.home','broken');expect(readMissionDraft('home')).toEqual({});
 sessionStorage.setItem('starz.mission.home',JSON.stringify({ids:[false],x:'wrong',amount:null,target:'valid'}));expect(readMissionDraft('home')).toEqual({target:'valid'});
});
