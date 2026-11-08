import {seededRandom,fbmNoise2D,starVisualConfig} from '../planet3d/planetVisual';

/** Decorative points only: rejection density + minimum separation, never gameplay locations. */
export function decorativeStars(seed:string,count=420){
 const stars:{x:number;y:number;size:number;brightness:number}[]=[];
 const clusters=Array.from({length:3},(_,i)=>({x:seededRandom(seed,'cluster-x',i),y:seededRandom(seed,'cluster-y',i)}));
 for(let i=0;stars.length<count&&i<count*40;i++){
  const x=seededRandom(seed,'point-x',i),y=seededRandom(seed,'point-y',i);
  const density=.25+clusters.reduce((sum,c)=>sum+.25*Math.exp(-((x-c.x)**2+(y-c.y)**2)/.035),0);
  if(seededRandom(seed,'density',i)>density||stars.some(p=>(p.x-x)**2+(p.y-y)**2<.012**2))continue;
  const bright=seededRandom(seed,'brightness',i);
  stars.push({x,y,size:bright>.985?2:1,brightness:bright>.985?.8:bright>.78?.52:.3});
 }
 return stars;
}

export function stellarAppearance(stellarClass:string){
 const type=stellarClass.toUpperCase();
 return {color:starVisualConfig({stellar_class:type,luminosity:1}).color,stellarClass:type};
}
/** Sample the sphere in 3D before projecting to noise, so both longitude edges agree. */
export function stellarSurface(seed:string,width=96,height=48){
 const data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const longitude=x/(width-1)*Math.PI*2,latitude=y/(height-1)*Math.PI;
  const nx=Math.cos(longitude)*Math.sin(latitude),ny=Math.cos(latitude),nz=Math.sin(longitude)*Math.sin(latitude);
  const macro=fbmNoise2D(seed,nx*4+nz*2,ny*4-nz*3,3,'stellar-cells');
  const grain=fbmNoise2D(seed,nx*23+nz*11,ny*23-nz*7,2,'stellar-grain');
  const level=Math.max(0,Math.min(3,Math.floor((macro*.65+grain*.35)*5.2-.7)));
  const offset=(y*width+x)*4;data[offset]=data[offset+1]=data[offset+2]=level*85;data[offset+3]=255;
 }
 return data;
}

/** Project a complete circular orbit, including body radius, into camera right/up axes. */
export function orbitalFrame(radius:number,bodyRadius:number,width:number,height:number,right:{x:number;z:number},up:{x:number;z:number}){
 const x=radius*Math.hypot(right.x,right.z)+bodyRadius,y=radius*Math.hypot(up.x,up.z)+bodyRadius;
 const marginX=Math.min(52,width*.1),marginY=Math.min(40,height*.12);
 const halfHeight=Math.max(y*height/Math.max(1,height-2*marginY),x*height/Math.max(1,width-2*marginX));
 return {halfHeight,halfWidth:halfHeight*width/Math.max(1,height),x,y};
}
