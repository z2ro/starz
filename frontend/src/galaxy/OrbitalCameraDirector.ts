import * as THREE from 'three';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {orbitalFrame} from './galaxyVisuals';

export type OrbitalBody={position:THREE.Vector3;radius:number;labelWidth?:number;labelHeight?:number};
type Disk={x:number;y:number;r:number};
type Rect={left:number;right:number;top:number;bottom:number};
/** Same placement rules for camera planning and the rendered HTML annotations. */
export function orbitalLabelRect(point:Disk,labelWidth:number,labelHeight:number,width:number,height:number,obstacles:readonly Disk[],placed:readonly Rect[]=[]):Rect|undefined {
 const {x,y,r}=point,left=x-labelWidth/2;
 const candidates=[{left,top:y-r-8-labelHeight},{left,top:y+r+8},{left:x-r-8-labelWidth,top:y-labelHeight/2},{left:x+r+8,top:y-labelHeight/2},
  ...[-1,1].flatMap(side=>[-1,1].map(vertical=>({left:side<0?x-r-8-labelWidth:x+r+8,top:vertical<0?y-r-8-labelHeight:y+r+8})))];
 for(const candidate of candidates){
  const left=Math.max(4,Math.min(width-labelWidth-4,candidate.left)),top=Math.max(4,Math.min(height-labelHeight-4,candidate.top));
  const box={left,right:left+labelWidth,top,bottom:top+labelHeight};
  if(box.right>width-4||box.bottom>height-4||obstacles.some(b=>box.left<b.x+b.r+4&&box.right>b.x-b.r-4&&box.top<b.y+b.r+4&&box.bottom>b.y-b.r-4)||placed.some(b=>box.left<b.right+4&&box.right>b.left-4&&box.top<b.bottom+4&&box.bottom>b.top-4))continue;
  return box;
 }
}
/** Choose a view, never move bodies: score projected clearance and label room at Reset only. */
export function chooseOrbitalCamera(bodies:readonly OrbitalBody[],orbitRadius:number,starRadius:number,width:number,height:number){
 const innerRadius=Math.min(...bodies.map(p=>p.position.length()));
 const minimumElevation=bodies.length?Math.asin(Math.min(.98,(starRadius+.08)/Math.max(.001,innerRadius))):0;
 const preferredElevation=Math.max(width/height>2?.48:.68,minimumElevation),baseAzimuth=Math.atan2(9,4);
 const bodyRadius=Math.max(0,...bodies.map(p=>p.radius));
 let best: {direction:THREE.Vector3;frame:ReturnType<typeof orbitalFrame>;score:number}|undefined;
 for(const elevation of [preferredElevation,.85,1.08,.38])for(let i=0;i<12;i++){
  const azimuth=baseAzimuth+i*Math.PI/6,direction=new THREE.Vector3(Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.sin(azimuth)*Math.cos(elevation));
  const right=new THREE.Vector3(direction.z,0,-direction.x).normalize(),up=direction.clone().cross(right);
  const frame=orbitalFrame(orbitRadius,bodyRadius,width,height,right,up,starRadius),scale=height/(2*frame.halfHeight);
  const projected=[{x:width/2,y:height/2,r:starRadius*scale,labelWidth:0,labelHeight:0},...bodies.map(p=>({x:width/2+p.position.dot(right)*scale,y:height/2-p.position.dot(up)*scale,r:p.radius*scale,labelWidth:p.labelWidth??0,labelHeight:p.labelHeight??0}))];
  let score=Math.abs(elevation-preferredElevation)*2+Math.min(i,12-i)*.08;
  if(elevation<minimumElevation)continue;
  for(let a=0;a<projected.length;a++){
   const p=projected[a];
   for(let b=0;b<a;b++){const q=projected[b],gap=Math.hypot(p.x-q.x,p.y-q.y)-p.r-q.r;score+=Math.max(0,10-gap)**2;}
   if(p.labelHeight&&!orbitalLabelRect(p,p.labelWidth,p.labelHeight,width,height,projected))score+=1000;
  }
  if(!best||score<best.score)best={direction,frame,score};
 }
 return best!;
}

type Controls=Pick<OrbitControls,'target'|'update'|'enableDamping'>;
export class OrbitalCameraDirector {
 private transition?:{start:number;position:THREE.Vector3;target:THREE.Vector3;zoom:number;endPosition:THREE.Vector3;endTarget:THREE.Vector3;endZoom:number};
 constructor(private camera:THREE.OrthographicCamera,private controls:Controls){}
 get moving(){return !!this.transition;}
 cancel(){this.transition=undefined;}
 reset(bodies:readonly OrbitalBody[],orbitRadius:number,starRadius:number,width:number,height:number){
  this.cancel();const view=chooseOrbitalCamera(bodies,orbitRadius,starRadius,width,height);
  const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();
  this.controls.target.set(0,0,0);this.camera.position.copy(view.direction).multiplyScalar(20);this.camera.up.set(0,1,0);this.camera.zoom=1;
  Object.assign(this.camera,{left:-view.frame.halfWidth,right:view.frame.halfWidth,top:view.frame.halfHeight,bottom:-view.frame.halfHeight});
  this.camera.updateProjectionMatrix();this.camera.lookAt(this.controls.target);this.controls.update();this.camera.updateMatrixWorld(true);this.controls.enableDamping=damping;
  return view.frame;
 }
 focus(body:OrbitalBody,context:{bodies:readonly OrbitalBody[];starRadius:number;width:number;height:number},reducedMotion:boolean,now:number){
  this.camera.updateMatrixWorld(true);const m=this.camera.matrixWorld.elements,right=new THREE.Vector3(m[0],m[1],m[2]),up=new THREE.Vector3(m[4],m[5],m[6]);
  let target=body.position.clone().multiplyScalar(.18),zoom=.65,found=false;
  for(const candidateZoom of [1.1,1,.9,.8,.7,.65]){
   for(const weight of [.18,.08,0]){
    const candidate=body.position.clone().multiplyScalar(weight),scale=context.height/(2*this.camera.top)*candidateZoom;
    const project=(position:THREE.Vector3,radius:number)=>({x:context.width/2+(position.dot(right)-candidate.dot(right))*scale,y:context.height/2-(position.dot(up)-candidate.dot(up))*scale,r:radius*scale});
    const disks=[project(new THREE.Vector3(),context.starRadius),...context.bodies.map(p=>project(p.position,p.radius))],selected=project(body.position,body.radius);
    if(disks.slice(0,1).concat([selected]).some(p=>p.x-p.r<4||p.x+p.r>context.width-4||p.y-p.r<4||p.y+p.r>context.height-4))continue;
    if(orbitalLabelRect(selected,body.labelWidth??120,body.labelHeight??44,context.width,context.height,disks)){target=candidate;zoom=candidateZoom;found=true;break;}
   }
   if(found)break;
  }
  const offset=this.camera.position.clone().sub(this.controls.target);
  this.transition={start:now,position:this.camera.position.clone(),target:this.controls.target.clone(),zoom:this.camera.zoom,endPosition:target.clone().add(offset),endTarget:target,endZoom:zoom};
  if(reducedMotion)this.update(now+360);
 }
 update(now:number){
  const move=this.transition;if(!move)return false;
  const progress=THREE.MathUtils.clamp((now-move.start)/360,0,1),t=progress*progress*(3-2*progress);
  this.camera.position.lerpVectors(move.position,move.endPosition,t);this.controls.target.lerpVectors(move.target,move.endTarget,t);this.camera.zoom=THREE.MathUtils.lerp(move.zoom,move.endZoom,t);this.camera.updateProjectionMatrix();
  if(progress===1)this.cancel();return true;
 }
}
