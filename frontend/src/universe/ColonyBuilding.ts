import * as THREE from 'three';

/** Presentation only: the planet snapshot determines which installations exist. */
export function createColonyBuilding(id:string,selected:boolean) {
  const group=new THREE.Group();
  const materials:THREE.Material[]=[];
  const matte=(color:number)=>{const m=new THREE.MeshLambertMaterial({color,flatShading:true});materials.push(m);return m;};
  const paint=matte(id==='civil_district'?0xe4dfc7:id==='ore_extractor'?0xd8974c:0x6ba9a6);
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
  }
  return {group,animate,dispose:()=>{
    group.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});
    materials.forEach(material=>material.dispose());
  }};
}
