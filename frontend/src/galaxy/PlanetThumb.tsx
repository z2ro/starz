import {useEffect,useRef} from 'react';
import {planetSurfaceColor,samplePlanet,type PlanetGenerationSettings} from '../planetlab/planetGenerator';

/** Small lit disc of a generated planet, sampled from the same generator as the orbital scene. Decorative only. */
export function PlanetThumb({settings,size=40}:{settings:PlanetGenerationSettings;size?:number}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let ctx:CanvasRenderingContext2D|null=null;try{ctx=canvas.current?.getContext('2d')??null;}catch{return;}
    if(!ctx)return;
    const n=28,image=ctx.createImageData(n,n),r=n/2-.5;
    for(let py=0;py<n;py++)for(let px=0;px<n;px++){
      const x=(px-r)/r,y=(r-py)/r,d=x*x+y*y;if(d>1)continue;
      const z=Math.sqrt(1-d),[red,green,blue]=planetSurfaceColor(samplePlanet({x,y,z},settings));
      // Three flat light bands keep the disc readable as pixel art.
      const light=[.42,.7,1][Math.min(2,Math.floor(Math.max(0,-.5*x+.5*y+.7*z)*3))],offset=(py*n+px)*4;
      image.data[offset]=red*light;image.data[offset+1]=green*light;image.data[offset+2]=blue*light;image.data[offset+3]=255;
    }
    ctx.putImageData(image,0,0);
  },[settings.seed,settings.family,settings.waterCoverage,settings.temperature]);
  return <canvas ref={canvas} className="planet-thumb" width={28} height={28} style={{width:size,height:size}} aria-hidden="true"/>;
}
