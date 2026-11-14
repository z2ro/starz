import * as THREE from 'three';

/** Decorative geometry only; visibility and levels belong to the planet snapshot. */
export function createColonyBuilding(id:string,selected:boolean) {
  const group=new THREE.Group();const moving:THREE.Object3D[]=[];
  const steel=new THREE.MeshStandardMaterial({color:id==='civil_district'?0xc5d4d0:id==='ore_extractor'?0xc18043:0x598f9b,roughness:.8});
  const edge=new THREE.MeshStandardMaterial({color:0xc1c9bf,roughness:.7});
  const dark=new THREE.MeshStandardMaterial({color:0x273d55,roughness:.9});
  const amber=new THREE.MeshBasicMaterial({color:0xe9ad52});
  const cyan=new THREE.MeshBasicMaterial({color:0x69d4df});
  const materials=[steel,edge,dark,amber,cyan];
  function mesh(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.id=id;group.add(m);return m;}
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material=steel)=>mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  box(0,.11,0,2.7,.22,2.3,dark);box(0,.24,0,2.55,.06,2.15,edge);
  for(const x of [-1.15,1.15])for(const z of [-.92,.92]){box(x,.39,z,.1,.24,.1,dark);box(x,.53,z,.12,.08,.12,selected?cyan:amber);}
  if(id==='civil_district'){
    box(-.55,.85,-.3,.65,1.2,.7);box(-.55,1.52,-.3,.77,.14,.82,edge);
    box(-.55,1.75,-.3,.13,.33,.13,dark);box(-.55,1.94,-.3,.1,.06,.1,cyan);
    box(.48,.48,-.2,1.05,.4,1.05,dark);
    const dome=mesh(new THREE.SphereGeometry(.57,12,6,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x287d9c,roughness:.4,metalness:.35,flatShading:true}),.48,.69,-.2);materials.push(dome.material as THREE.MeshStandardMaterial);
    const ribs=new THREE.LineSegments(new THREE.EdgesGeometry(dome.geometry),new THREE.LineBasicMaterial({color:0x81c5cd}));dome.add(ribs);
    for(let y=.55;y<1.4;y+=.25){for(const x of [-.72,-.4])box(x,y,.058,.12,.12,.018,amber);box(-.213,y,-.3,.018,.12,.25,cyan);}
    box(0,.48,.65,1.65,.4,.4);for(let x=-.6;x<.7;x+=.3)box(x,.5,.86,.15,.13,.018,amber);
  }else if(id==='ore_extractor'){
    box(.42,.65,-.18,1.1,.75,1.05);box(.42,1.07,-.18,1.22,.12,1.16,edge);
    for(const z of [-.65,.4]){box(-.55,.55,z,.22,.6,.18,edge);box(-.55,.86,z,1.25,.15,.18,amber);}
    const drill=mesh(new THREE.ConeGeometry(.32,1.05,8),edge,-.6,.65,-.12);drill.rotation.z=Math.PI/2;moving.push(drill);
    for(let n=0;n<4;n++){const collar=mesh(new THREE.TorusGeometry(.12+n*.045,.045,4,8),dark,-1+n*.2,.65,-.12);collar.rotation.y=Math.PI/2;}
    for(let n=0;n<6;n++){const rock=mesh(new THREE.DodecahedronGeometry(.12+(n%2)*.05),n%2?edge:cyan,-1.2+(n%3)*.16,.35,.32+Math.floor(n/3)*.22);rock.scale.y=.65;}
    box(.45,.73,.36,.5,.13,.025,cyan);
  }else if(id==='fuel_refinery'){
    for(const x of [-.65,.05]){mesh(new THREE.CylinderGeometry(.26,.26,.9,10),edge,x,.75,.18);mesh(new THREE.CylinderGeometry(.27,.27,.12,10),amber,x,.83,.18);mesh(new THREE.ConeGeometry(.27,.18,10),steel,x,1.29,.18);}
    box(.65,.76,-.45,.46,1,.52);box(.65,1.35,-.45,.23,.2,.23,dark);
    mesh(new THREE.CylinderGeometry(.07,.07,1.5,6),dark,-.25,1.05,-.6);
    const beacon=mesh(new THREE.OctahedronGeometry(.09),cyan,-.25,1.83,-.6);moving.push(beacon);
    for(const z of [.62,.79]){const pipe=mesh(new THREE.CylinderGeometry(.045,.045,1.85,6),z===.62?amber:edge,0,.4,z);pipe.rotation.z=Math.PI/2;}
    const fan=box(.65,1.5,-.45,.3,.04,.08,edge);moving.push(fan);
  }
  // Contrasting roof plates, ribs and stairs make each silhouette readable at game scale.
  if(id==='civil_district'){
    for(const x of [-.89,-.22])box(x,.9,-.3,.055,1.1,.75,edge);
    box(-.55,1.61,-.3,.56,.06,.62,cyan);
    for(let n=0;n<3;n++)box(.1,.12+n*.055,1.21-n*.12,.65,.08,.2,edge);
    const dish=mesh(new THREE.ConeGeometry(.24,.12,10),edge,-.55,1.99,-.3);dish.rotation.z=.5;
  }
  if(id==='ore_extractor'){
    for(const z of [-.69,.45])for(const x of [-.8,-.25])box(x,.55,z,.09,.65,.09,dark);
    box(.45,1.17,-.18,.9,.08,.8,amber);
    for(let n=0;n<5;n++)box(.15+n*.15,1.23,-.18,.05,.04,.65,dark);
  }
  if(id==='fuel_refinery'){
    for(const x of [-.65,.05])box(x,1.43,.18,.12,.15,.12,cyan);
    for(let n=0;n<5;n++)box(.91,.46+n*.17,-.45,.035,.035,.4,amber);
    box(.65,1.3,-.45,.62,.07,.65,edge);
  }
  // Panel seams and footings share the same industrial scale across all three designs.
  for(const x of [-1,0,1])box(x,.285,.95,.06,.025,.18,amber);
  for(const x of [-1.24,1.24])box(x,.285,0,.035,.025,1.85,dark);
  if(id==='ore_extractor')for(let i=0;i<4;i++)box(.12+i*.19,.72,.36,.08,.3,.03,dark);
  if(id==='fuel_refinery')for(const x of [-.65,.05])for(const y of [.45,1.05])mesh(new THREE.TorusGeometry(.27,.018,4,10),dark,x,y,.18).rotation.x=Math.PI/2;
  return {group,animate:(time:number)=>{if(id==='ore_extractor'&&moving[0])moving[0].rotation.x=Math.floor(time*8)*Math.PI/12;if(id==='fuel_refinery'){moving[0].scale.setScalar(.9+.1*Math.sin(time*1.4));moving[1].rotation.y=Math.floor(time*6)*Math.PI/6;}},dispose:()=>{group.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.LineSegments){object.geometry.dispose();if(object instanceof THREE.LineSegments)(object.material as THREE.Material).dispose();}});materials.forEach(m=>m.dispose());}};
}
