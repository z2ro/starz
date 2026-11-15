import * as THREE from 'three';

const PAINT:Record<string,number>={civil_district:0xe4dfc7,ore_extractor:0xd8974c,fuel_refinery:0x6ba9a6,solar_field:0x304b65,processor:0x9aa39b,research_lab:0xd3d9cc,orbital_shipyard:0xc9cfc4,volatile_well:0xb69e62,manufacturing:0x8a938d,civil_lab:0xe0cd9a,military_lab:0x6f8b4a,fundamental_lab:0xbcd6d8};

/** Presentation only: the planet snapshot determines which installations exist. */
export function createColonyBuilding(id:string,selected:boolean) {
  const group=new THREE.Group();
  const materials:THREE.Material[]=[];
  const matte=(color:number)=>{const m=new THREE.MeshLambertMaterial({color,flatShading:true});materials.push(m);return m;};
  const paint=matte(PAINT[id]??0x6ba9a6);
  const ivory=matte(0xddd8bf),dark=matte(0x2b4555),metal=matte(0x7c9397),glass=matte(0x287e94),rust=matte(0x98634d);
  const cyan=new THREE.MeshBasicMaterial({color:0x9be7dc});const amber=new THREE.MeshBasicMaterial({color:0xffca75});materials.push(cyan,amber);
  const mesh=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number)=>{
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.id=id;group.add(m);return m;
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material=paint)=>mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const cylinder=(x:number,y:number,z:number,r:number,h:number,mat:THREE.Material=metal)=>mesh(new THREE.CylinderGeometry(r,r,h,12),mat,x,y,z);
  const beam=(a:THREE.Vector3,b:THREE.Vector3,width:number,mat:THREE.Material)=>{
    const m=box((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,width,a.distanceTo(b),width,mat);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;
  };
  const ring=(x:number,y:number,z:number,r:number,mat:THREE.Material=ivory)=>{
    const m=mesh(new THREE.TorusGeometry(r,.025,4,16),mat,x,y,z);m.rotation.x=Math.PI/2;return m;
  };
  box(0,.08,0,2.7,.16,2.3,dark);box(0,.18,0,2.62,.05,2.22,metal);
  // Inset deck panels, access steps and edge lights tie the separate silhouettes together.
  for(let x=-1;x<=1;x+=.5)for(let z=-.75;z<=.75;z+=.5)box(x,.215,z,.47,.02,.47,ivory);
  for(let n=0;n<3;n++)box(.3,.04+n*.05,1.4-n*.12,.65,.06,.2,metal);
  for(const x of [-1.2,1.2])for(const z of [-.96,.96]){
    box(x,.34,z,.08,.24,.08,dark);box(x,.48,z,.12,.07,.12,selected?cyan:amber);
  }
  for(const x of [-1.31,1.31])box(x,.23,0,.035,.025,2.1,selected?cyan:dark);
  let animate=(_time:number)=>{};
  if(id==='civil_district'){
    // A stepped command spine and a ribbed habitat dome, not another industrial shed.
    box(-.75,.85,-.44,.62,1.25,.68);box(-.75,1.53,-.44,.75,.12,.82,ivory);
    box(-.75,1.65,-.44,.55,.13,.6,dark);box(-.75,1.73,-.44,.5,.035,.55,cyan);
    for(const x of [-1.07,-.43])box(x,.9,-.44,.06,1.15,.71,metal);
    for(let y=.48;y<1.5;y+=.24)for(const x of [-.9,-.65])box(x,y,-.09,.13,.13,.025,amber);
    cylinder(.38,.4,-.3,.78,.3,dark);cylinder(.38,.56,-.3,.79,.08,ivory);
    mesh(new THREE.SphereGeometry(.74,16,8,0,Math.PI*2,0,Math.PI/2),glass,.38,.6,-.3);
    for(let a=0;a<Math.PI;a+=Math.PI/4){
      const rib=mesh(new THREE.TorusGeometry(.745,.018,4,24,Math.PI),ivory,.38,.6,-.3);rib.rotation.y=a;
    }
    ring(.38,.61,-.3,.75);
    box(.1,.45,.62,1.7,.44,.5);box(.1,.71,.62,1.82,.08,.6,metal);
    for(let x=-.55;x<.9;x+=.28)box(x,.5,.88,.19,.16,.02,glass);
    box(.32,.41,.9,.23,.36,.06,dark);box(.32,.62,.94,.23,.04,.035,cyan);
    cylinder(-.75,1.98,-.44,.035,.5,dark);
    const dish=mesh(new THREE.SphereGeometry(.23,12,5,0,Math.PI*2,0,Math.PI/3),ivory,-.75,2.2,-.44);dish.rotation.z=.65;
    animate=time=>{dish.rotation.y=Math.sin(time*.23)*.4;};
  }else if(id==='ore_extractor'){
    // A tall braced drilling gantry and a low conveyor give the extractor its own profile.
    box(.62,.6,-.45,.85,.72,.8);box(.62,1,-.45,.96,.1,.9,dark);
    for(let n=0;n<4;n++)box(.38+n*.15,.69,-.035,.07,.3,.025,dark);
    box(.62,1.08,-.45,.74,.06,.68,ivory);
    for(const x of [-1.02,-.12]){
      box(x,1.04,-.35,.13,1.6,.16,dark);
      box(x,1.1,-.25,.08,1.5,.06,paint);
    }
    box(-.57,1.86,-.35,1.2,.2,.42);box(-.57,1.99,-.35,1.26,.05,.45,ivory);
    beam(new THREE.Vector3(-1.02,.4,-.34),new THREE.Vector3(-.12,1.7,-.34),.055,metal);
    cylinder(-.56,1.32,-.05,.11,1.05,metal);
    const drill=mesh(new THREE.ConeGeometry(.25,.6,8),dark,-.56,.63,-.05);drill.rotation.z=Math.PI;
    for(let n=0;n<3;n++)ring(-.56,.62+n*.12,-.05,.17+n*.025,ivory);
    box(.2,.36,.65,1.7,.18,.4,dark);
    for(let n=0;n<7;n++){const roller=cylinder(-.5+n*.21,.46,.65,.055,.42,metal);roller.rotation.x=Math.PI/2;}
    for(let n=0;n<5;n++){const ore=mesh(new THREE.DodecahedronGeometry(.09),rust,-.47+n*.27,.56,.65);ore.scale.set(1,.7,.8);}
    for(let n=0;n<4;n++)box(-1.08+n*.18,.25,.28,.12,.04,.3,n%2?dark:amber);
    animate=time=>{drill.position.y=.63+Math.round(Math.sin(time*2)*2)*.025;drill.rotation.y=Math.floor(time*8)*Math.PI/12;};
  }else if(id==='fuel_refinery'){
    // Tall fractionation column, paired pressure tanks and exposed service pipework.
    for(const x of [-.75,-.1]){
      cylinder(x,.8,.16,.28,1,ivory);
      mesh(new THREE.SphereGeometry(.28,12,6,0,Math.PI*2,0,Math.PI/2),paint,x,1.3,.16);
      for(const y of [.48,1.1])cylinder(x,y,.16,.29,.09,dark);
      cylinder(x,.82,.16,.285,.16,paint);box(x,.84,.45,.1,.08,.02,amber);
    }
    cylinder(.68,1,-.45,.28,1.55,paint);
    for(const y of [.35,.75,1.15,1.65])cylinder(.68,y,-.45,.32,.07,ivory);
    cylinder(.68,1.96,-.45,.12,.4,dark);ring(.68,2.15,-.45,.13,ivory);
    for(let n=0;n<8;n++)box(.99,.39+n*.19,-.45,.03,.035,.28,amber);
    for(const z of [.65,.84]){const pipe=cylinder(0,.43,z,.055,2.1,z===.65?paint:ivory);pipe.rotation.z=Math.PI/2;}
    for(const x of [-1,.95])cylinder(x,.35,.75,.06,.25,dark);
    box(-.45,.37,-.66,.9,.27,.43,dark);
    for(let n=0;n<4;n++)box(-.77+n*.2,.53,-.66,.08,.03,.34,metal);
    const steamMat=new THREE.MeshLambertMaterial({color:0xc7dbd4,transparent:true,opacity:0,depthWrite:false});materials.push(steamMat);
    const steam=mesh(new THREE.IcosahedronGeometry(.1),steamMat,.68,2.3,-.45);steam.castShadow=false;
    animate=time=>{const phase=(time%9)/9;steam.visible=phase<.28;steamMat.opacity=phase<.28?Math.sin(phase/.28*Math.PI)*.32:0;const rise=Math.min(phase,.28);steam.position.set(.68+rise*.5,2.25+rise*1.4,-.45);steam.scale.setScalar(1+rise*2);};
  }else if(id==='solar_field'){
    // Rows of sun-tracking panels and a small inverter hut.
    const panels:THREE.Mesh[]=[];
    for(const x of [-.8,0,.8])for(const z of [-.5,.35]){
      box(x,.38,z,.07,.36,.07,dark);
      panels.push(box(x,.6,z,.68,.04,.5),box(x,.6,z,.02,.05,.5,ivory),box(x,.6,z,.68,.05,.02,ivory));
    }
    box(1.05,.4,.78,.4,.38,.36,ivory);box(1.05,.61,.78,.46,.05,.42,dark);box(1.05,.45,.97,.12,.12,.02,amber);
    animate=time=>{const tilt=-.5+Math.sin(time*.15)*.12;panels.forEach(panel=>{panel.rotation.x=tilt;});};
  }else if(id==='processor'){
    // Furnace hall with twin stacks, a feed hopper and an ingot line.
    box(-.25,.62,-.2,1.5,.8,1.1);box(-.25,1.06,-.2,1.6,.1,1.2,dark);
    for(let n=0;n<4;n++)box(-.8+n*.36,.55,.36,.2,.3,.03,amber);
    for(const x of [-.7,-.15]){cylinder(x,1.55,-.45,.13,.9,rust);cylinder(x,2.02,-.45,.16,.06,dark);}
    box(.85,.75,-.3,.5,.1,.5,metal);mesh(new THREE.ConeGeometry(.36,.5,4),paint,.85,.48,-.3).rotation.x=Math.PI;
    for(const x of [.62,1.08])for(const z of [-.53,-.07])box(x,.5,z,.05,.55,.05,dark);
    box(.55,.36,.62,1.2,.14,.36,dark);for(let n=0;n<4;n++)box(.1+n*.3,.46,.62,.18,.08,.24,rust);
    const glow=box(-.25,.3,.39,1.3,.06,.04,amber);
    animate=time=>{glow.scale.x=.75+Math.sin(time*1.7)*.25;};
  }else if(id==='research_lab'){
    // Clean laboratory block, glazed gallery, observatory dome and a tracking dish.
    box(-.3,.6,-.25,1.5,.76,1);box(-.3,1.01,-.25,1.58,.06,1.08,ivory);
    box(-.3,.62,.26,1.3,.2,.03,glass);box(-.3,.4,.27,.24,.34,.04,dark);
    box(.8,.45,.45,.7,.46,.8,ivory);box(.8,.7,.45,.76,.05,.86,metal);for(let n=0;n<3;n++)box(.56+n*.24,.5,.86,.14,.14,.02,cyan);
    cylinder(.8,.9,.45,.2,.36,paint);mesh(new THREE.SphereGeometry(.2,10,5,0,Math.PI*2,0,Math.PI/2),glass,.8,1.08,.45);
    cylinder(-.3,1.3,-.25,.05,.55,dark);
    const dish=mesh(new THREE.SphereGeometry(.4,12,5,0,Math.PI*2,0,Math.PI/3),ivory,-.3,1.7,-.25);dish.rotation.z=.8;
    animate=time=>{dish.rotation.y=time*.3;};
  }else if(id==='orbital_shipyard'){
    // Ground terminal of the orbital yard: launch pad, service gantry and a cargo shuttle.
    cylinder(.35,.26,0,.85,.1,dark);ring(.35,.32,0,.8,amber);
    cylinder(.35,.9,0,.2,1.1,ivory);mesh(new THREE.ConeGeometry(.2,.45,10),paint,.35,1.67,0);
    for(const a of [0,2.1,4.2])box(.35+Math.cos(a)*.26,.5,Math.sin(a)*.26,.12,.4,.12,rust);
    box(-.75,1.05,-.3,.3,1.7,.3,metal);for(let y=.5;y<1.9;y+=.35)box(-.75,y,-.3,.34,.04,.34,dark);
    const arm=box(-.3,1.35,-.3,.7,.07,.12,dark);
    box(-.8,.42,.65,.8,.4,.5);box(-.8,.65,.65,.86,.06,.56,dark);box(-.8,.45,.91,.3,.14,.02,cyan);
    const lamp=box(-.75,1.95,-.3,.1,.1,.1,amber);
    animate=time=>{lamp.visible=time%1.2<.6;arm.position.y=1.35+Math.sin(time*.4)*.06;};
  }else if(id==='volatile_well'){
    // Wellhead with a rocking pump beam and a pressure sphere.
    box(-.6,.42,-.2,.5,.4,.5,dark);cylinder(-.6,.7,-.2,.09,.3,metal);
    beam(new THREE.Vector3(-.15,.22,-.38),new THREE.Vector3(-.15,1.15,-.2),.08,rust);beam(new THREE.Vector3(-.15,.22,-.02),new THREE.Vector3(-.15,1.15,-.2),.08,rust);
    const arm=box(-.3,1.18,-.2,1.3,.1,.12),head=box(-.92,1.05,-.2,.16,.34,.18,dark);
    mesh(new THREE.SphereGeometry(.48,12,8),ivory,.65,.75,.3);ring(.65,.75,.3,.49,paint);
    for(const a of [0,1.57,3.14,4.71])box(.65+Math.cos(a)*.34,.36,.3+Math.sin(a)*.34,.06,.34,.06,dark);
    cylinder(0,.3,.3,.05,.9,metal).rotation.z=Math.PI/2;box(.65,1.26,.3,.1,.08,.1,amber);
    animate=time=>{const swing=Math.sin(time*1.4);arm.rotation.z=swing*.16;head.position.y=1.05-swing*.1;};
  }else if(id==='manufacturing'){
    // Saw-tooth assembly hall with a loading crane.
    box(-.2,.55,-.2,1.9,.66,1.2);
    for(let n=0;n<4;n++){box(-.92+n*.48,.98,-.2,.5,.08,1.24,dark).rotation.z=.5;box(-.72+n*.48,.98,-.2,.03,.26,1.2,glass);}
    for(let n=0;n<5;n++)box(-.95+n*.38,.5,.41,.22,.26,.03,n%2?amber:glass);
    box(1.05,.95,.1,.1,1.5,.1,metal);box(.7,1.66,.1,.9,.08,.1,rust);
    const hook=box(.5,1.3,.1,.06,.6,.06,dark),crate=box(.5,.95,.1,.24,.2,.24,rust);
    box(.95,.32,.72,.5,.18,.4,rust);box(.4,.32,.72,.4,.18,.4,metal);
    animate=time=>{const x=.62+Math.sin(time*.5)*.25;hook.position.x=x;crate.position.x=x;};
  }else if(id==='civil_lab'){
    // Engineering workshop: drafting hall, load-test frame and a greenhouse module.
    box(-.45,.55,-.3,1.2,.66,.9);box(-.45,.92,-.3,1.3,.08,1,metal);box(-.45,.56,.16,1,.18,.03,glass);
    for(const x of [.45,1.05])box(x,.75,-.4,.07,1.1,.07,dark);box(.75,1.3,-.4,.74,.07,.1,dark);
    const load=box(.75,.9,-.4,.3,.24,.3,rust);
    cylinder(.6,.34,.55,.5,.24,dark);mesh(new THREE.SphereGeometry(.48,12,6,0,Math.PI*2,0,Math.PI/2),glass,.6,.46,.55);
    box(-.9,1.2,-.3,.05,.5,.05,dark);box(-.9,1.46,-.3,.1,.06,.1,cyan);
    animate=time=>{load.position.y=.75+Math.abs(Math.sin(time*.6))*.35;};
  }else if(id==='military_lab'){
    // Low armoured bunker with a sweeping radar and blast walls.
    box(-.2,.5,-.2,1.9,.56,1.3,dark);box(-.2,.82,-.2,1.6,.12,1.05);box(-.2,.92,-.2,1.2,.1,.75,dark);
    for(let n=0;n<4;n++)box(-.8+n*.4,.52,.46,.22,.1,.03,amber);
    for(const x of [-1.1,.7])box(x,.5,.6,.12,.6,.5,metal);
    cylinder(.35,1.2,-.3,.05,.5,metal);const radar=box(.35,1.5,-.3,.7,.3,.05,ivory);
    box(-.75,1.1,-.3,.05,.4,.05,metal);const lamp=box(-.75,1.33,-.3,.1,.08,.1,rust);
    box(1.05,.4,-.5,.3,.36,.3,rust);box(1.05,.4,0,.3,.36,.3,metal);
    animate=time=>{radar.rotation.y=time*.8;lamp.visible=time%2<1;};
  }else if(id==='fundamental_lab'){
    // Ring accelerator around a containment core.
    mesh(new THREE.TorusGeometry(.85,.11,6,20),metal,0,.45,0).rotation.x=Math.PI/2;
    for(let n=0;n<8;n++){const a=n/8*Math.PI*2;box(Math.cos(a)*.85,.45,Math.sin(a)*.85,.2,.3,.2,n%2?paint:dark);}
    cylinder(0,.5,0,.3,.6,ivory);cylinder(0,.84,0,.34,.08,dark);
    const core=mesh(new THREE.IcosahedronGeometry(.2),cyan,0,1.25,0);
    for(const a of [.8,2.9,5])beam(new THREE.Vector3(Math.cos(a)*.3,.85,Math.sin(a)*.3),new THREE.Vector3(Math.cos(a)*.12,1.2,Math.sin(a)*.12),.04,dark);
    box(-1,.45,.78,.5,.46,.36,ivory);box(-1,.7,.78,.56,.05,.42,metal);
    animate=time=>{core.position.y=1.25+Math.sin(time*1.2)*.06;core.rotation.y=time;};
  }
  return {group,animate,dispose:()=>{
    group.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});
    materials.forEach(material=>material.dispose());
  }};
}
