import * as THREE from './vendor/three.module.js';
import { mergeVertices } from './vendor/BufferGeometryUtils.js';
import { logoContours } from './assets/logo-contours.js';
export { THREE };
export const PALETTE = ['#ee3825','#ff6b0b','#fec306','#77bd20','#188ad9'];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{const v=clamp((t-a)/(b-a));return v*v*(3-2*v);};
const lerp=(a,b,t)=>a+(b-a)*t;
const S=2.4/350;
const localPaths=logoContours.map(c=>c.map(([x,y])=>new THREE.Vector3((x-319.5)*S,(319.5-y)*S,0)));
function pathSamples(points,n){
  const lengths=[0];for(let i=1;i<=points.length;i++)lengths.push(lengths.at(-1)+points[(i)%points.length].distanceTo(points[i-1]));
  return Array.from({length:n+1},(_,j)=>{let d=j/n*lengths.at(-1),i=1;while(i<lengths.length-1&&lengths[i]<d)i++;return points[i-1].clone().lerp(points[i%points.length],(d-lengths[i-1])/(lengths[i]-lengths[i-1]));});
}
const vertex=`varying vec3 vN; varying vec3 vW; varying vec3 vP;
void main(){vP=position;vW=(modelMatrix*vec4(position,1.)).xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`;
const fragment=`precision highp float;
varying vec3 vN; varying vec3 vW; varying vec3 vP;
uniform float uTime;uniform float uReveal;uniform float uLayer;uniform vec3 uColor;
vec3 spectrum(float x){
vec3 a=vec3(.933,.22,.145),b=vec3(1.,.42,.043),c=vec3(.996,.765,.024),d=vec3(.467,.741,.125),e=vec3(.094,.541,.851);
float p=clamp(x,0.,.999)*5.;return p<1.?a:p<2.?b:p<3.?c:p<4.?d:e;}
vec3 environment(vec3 r){
 float sweep=.35*sin(uTime*.31-1.3);
 float key=pow(max(0.,1.-abs(r.x*.7+r.y*.43-sweep)*1.5),12.);
 float strip=pow(max(0.,1.-abs(r.x*.65-r.y*.64+.25)*3.),30.);
 float top=pow(max(0.,r.y*.72+r.z*.46),10.);
 return vec3(.025,.034,.049)+vec3(.95,.98,1.)*(key*.88+strip*1.5+top*.6);
}
void main(){
 float threshold=(1.32-vP.y)/2.64;
 if(threshold>uReveal*1.15)discard;
 vec3 N=normalize(vN),V=normalize(cameraPosition-vW);
 float face=abs(N.z),ndv=max(.0,dot(N,V));float f=.04+.96*pow(1.-ndv,5.);
 vec3 R=reflect(-V,N);vec3 refr=refract(-V,N,1./1.48);
 vec3 reflectLight=environment(normalize(R+vec3(vP.x*.45,vP.y*.2,0.)));
 vec3 refrLight=environment(refr+vec3(.015,0.,0.));
 float band=pow(max(0.,1.-abs(vP.x*.45+vP.y*.2-sin(uTime*.25)*.8)*.8),5.);
 float edge=1.-pow(face,14.);
 float radius=length(vP.xy);
 float ringD=min(min(1.202-radius,radius-1.1068),(abs(vP.x+vP.y)-.06857)*.7071);
 float u=(vP.x-vP.y)*.7071,w=(vP.x+vP.y)*.7071;
 float topD=min(.0485-abs(w-.09698),min(u+1.518,u<.044?.044-u:-1.));
 float botD=min(.0485-abs(w+.09698),min(u+.044,1.527-u));
 float inside=max(ringD,max(topD,botD));
 float edgeLight=exp(-max(0.,inside)*140.);
 float spatial=sin(vP.x*2.6+vP.y*1.5-uTime*.26);
 float polished=pow(.5+.5*spatial,12.);
 float frontRim=pow(1.-face, .6);
 vec3 color=vec3(.012,.019,.03)+reflectLight*(.12+f*.45)+refrLight*.035;
 color+=vec3(.55,.68,.84)*polished*.20*pow(face,8.);
 color+=vec3(.7,.85,1.)*(edgeLight*.9+frontRim*.35);
 float spectral=pow(max(0.,1.-abs(vP.x+vP.y*.34-sin(uTime*.31)*1.1)*3.),3.);
 color+=spectrum(fract((vP.x-vP.y)*.35+.5))*spectral*(.035+edge*.34+edgeLight*.17);
 color+=vec3(.55,.7,.88)*pow(f,1.8)*.4;
 if(uLayer>0.5){
  float stripCoord=fract((vP.x-vP.y)*.32+.55);
  float lamina=1.-smoothstep(.018,.036,abs(stripCoord-(uLayer-.5)/5.));
  color=uColor*lamina*.13+vec3(.018,.025,.035)+reflectLight*.035;
 }
 float leading=1.-smoothstep(.0,.035,abs(threshold-uReveal*1.15));
 color+=vec3(.6,.75,1.)*leading*.5*(1.-step(.99,uReveal));
 float alpha=uLayer>.5?1.:clamp(.58+edgeLight*.42+f*.4,0.,1.);
 gl_FragColor=vec4(color,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export async function createExperience(canvas,options={}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(options.width||1920,options.height||1080,false);
 renderer.setClearColor(0x000000,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(58,(options.width||1920)/(options.height||1080),.05,90);
 camera.position.set(0,0,0);camera.lookAt(0,0,-1);
 const logo=new THREE.Group();logo.position.set(0,0,-4.5);logo.rotation.set(-.055,.19,0);scene.add(logo);
 const uniforms={uTime:{value:0},uReveal:{value:0},uLayer:{value:0},uColor:{value:new THREE.Color('#ffffff')}};
 const mat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,side:THREE.FrontSide,transparent:true,depthWrite:true});
 const shapes=localPaths.map(p=>{const s=new THREE.Shape();s.moveTo(p[0].x,p[0].y);p.slice(1).forEach(q=>s.lineTo(q.x,q.y));s.closePath();return s;});
 let geom=new THREE.ExtrudeGeometry(shapes,{depth:.12,bevelEnabled:true,bevelThickness:.012,bevelSize:.006,bevelSegments:4,steps:1,curveSegments:1});
 geom.translate(0,0,-.06);
 geom.deleteAttribute('normal');geom.deleteAttribute('uv');geom=mergeVertices(geom,0.0001);geom.computeVertexNormals();
 logo.add(new THREE.Mesh(geom,mat));
 // Five thin inset planes within the rear glass volume, visible at oblique edges.
 const glassLayers=[];
 PALETTE.forEach((color,i)=>{
   const lm=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{uTime:uniforms.uTime,uReveal:uniforms.uReveal,uLayer:{value:i+1},uColor:{value:new THREE.Color(color)}},side:THREE.DoubleSide});
   const lg=new THREE.ShapeGeometry(shapes);const m=new THREE.Mesh(lg,lm);
   m.position.set((i-2)*.0025,0,-.068-i*.008);logo.add(m);glassLayers.push(m);
 });
 // A separate, quiet signature belongs to the lobby only.
 const signature=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:0xe8f0ff,transparent:true,opacity:.72}));
 signature.scale.setScalar(.054);signature.rotation.copy(logo.rotation);signature.position.set(0,-.27,-2.8);scene.add(signature);
 const font=new FontFace('Space Grotesk',`url('${new URL('./assets/space-grotesk-latin.woff2',import.meta.url).href}')`);
 await font.load();document.fonts.add(font);await document.fonts.ready;
 const tc=document.createElement('canvas');tc.width=2048;tc.height=256;const ctx=tc.getContext('2d');
 ctx.clearRect(0,0,2048,256);ctx.font='500 100px "Space Grotesk"';ctx.fillStyle='#f4f7ff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.letterSpacing='5px';ctx.fillText('BIENVENIDO A OTRORAYO',1024,128);
 const textTex=new THREE.CanvasTexture(tc);textTex.colorSpace=THREE.SRGBColorSpace;
 const tm=new THREE.MeshBasicMaterial({map:textTex,transparent:true,depthWrite:false,toneMapped:false});
 const title=new THREE.Mesh(new THREE.PlaneGeometry(2.62,.3275),tm);title.position.set(0,.075,-2.8);scene.add(title);
 const strands=[];const N=128,R=6;
 const targets=localPaths.map(p=>pathSamples(p,N));
 const strandVert=`attribute float pathU;varying float vU;varying vec3 vW;void main(){vU=pathU;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`;
 const strandFrag=`uniform vec3 color;uniform float opacity;uniform float phase;uniform float convergence;uniform float halo;varying float vU;varying vec3 vW;
 void main(){float waves=.53+.47*pow(.5+.5*sin(vU*35.+phase),9.);float tail=smoothstep(0.,.065,vU)*(1.-smoothstep(.86,1.,vU));float a=opacity*mix(waves,1.,convergence)*mix(tail,1.,convergence);gl_FragColor=vec4(color*(halo>.5?.7:1.),a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include');
 for(let side=0;side<2;side++)for(let band=0;band<5;band++)for(let lane=0;lane<3;lane++){
  const geometry=new THREE.BufferGeometry();const pos=new Float32Array((N+1)*R*3),uv=new Float32Array((N+1)*R),ids=[];
  for(let j=0;j<=N;j++)for(let k=0;k<R;k++){uv[j*R+k]=j/N;if(j<N){const a=j*R+k,b=j*R+(k+1)%R,c=(j+1)*R+k,d=(j+1)*R+(k+1)%R;ids.push(a,b,c,b,d,c);}}
  geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('pathU',new THREE.BufferAttribute(uv,1));geometry.setIndex(ids);
  const su={color:{value:new THREE.Color(PALETTE[band])},opacity:{value:0},phase:{value:0},convergence:{value:0},halo:{value:0}};
  const material=new THREE.ShaderMaterial({vertexShader:strandVert,fragmentShader:strandFrag,uniforms:su,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});
  const core=new THREE.Mesh(geometry,material);core.frustumCulled=false;scene.add(core);
  let halo=null;
  if(lane===1){const hg=geometry.clone();const hm=material.clone();hm.uniforms={...su,opacity:{value:0},halo:{value:1}};halo=new THREE.Mesh(hg,hm);halo.frustumCulled=false;scene.add(halo);}
  strands.push({side,band,lane,geometry,pos,material,su,core,halo,target:targets[side]});
 }
 // Sparse highlights travel ON the strands, never through the center volume.
 const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(30*3),3));
 const pc=new Float32Array(30*3);for(let i=0;i<30;i++)new THREE.Color(PALETTE[i%5]).toArray(pc,i*3);particleGeo.setAttribute('color',new THREE.BufferAttribute(pc,3));
 const pm=new THREE.PointsMaterial({size:.017,vertexColors:true,transparent:true,depthWrite:false,opacity:0,blending:THREE.AdditiveBlending});
 const particles=new THREE.Points(particleGeo,pm);particles.frustumCulled=false;scene.add(particles);
 const eyeL=camera.clone(),eyeR=camera.clone();let lastTime=0;let view={yaw:0,pitch:0,stereo:false,detail:false};let dimensions=[options.width||1920,options.height||1080];
 function curve(s,u,t,c){
  const d=.75+u*43;const phase=t*.16;
  const angle=s.side*Math.PI+.42+Math.sin(d*.095-phase)*.68+(s.band-2)*.095+(s.lane-1)*.04;
  const radius=2.62+.32*Math.sin(d*.21-phase*.7+s.side)+(s.lane-1)*.12;
  const p=new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,-d);
  const idx=Math.min(N,Math.round(u*N));const q=s.target[idx].clone();
  const tangent=s.target[Math.min(N,idx+1)].clone().sub(s.target[Math.max(0,idx-1)]).normalize();
  const offset=(s.band-2)*.018+(s.lane-1)*.004;
  q.x+=-tangent.y*offset;q.y+=tangent.x*offset;
  q.z=-.018-(s.band-2)*.006-(s.lane-1)*.003;
  q.applyEuler(logo.rotation);q.add(logo.position);
  const delay=(1-u)*.055;const morph=smooth(delay,1,c);
  return p.lerp(q,morph);
 }
 function update(time){
  lastTime=Math.max(0,time);const t=lastTime-3;
  const textAlpha=1-smooth(0,1.5,t);tm.opacity=textAlpha;title.visible=textAlpha>.001;
  signature.material.opacity=textAlpha*(.7+.025*Math.sin(lastTime*.65));signature.visible=title.visible;
  const c=smooth(10.5,18.1,t);const enter=smooth(1.1,3.8,t);const fade=1-smooth(17.25,18.7,t);
  const rt=clamp(t,0,10.5),dt=clamp((t-10.5)/8,0,1);
  const phase=2*rt+.34*rt*rt+(2+.68*10.5)*8*(dt-dt**3+.5*dt**4);
  uniforms.uTime.value=lastTime;uniforms.uReveal.value=smooth(15.2,18.5,t);
  logo.visible=t>15.2;
  const tangent=new THREE.Vector3(),normal=new THREE.Vector3(),binormal=new THREE.Vector3();const zAxis=new THREE.Vector3(0,0,1),yAxis=new THREE.Vector3(0,1,0);
  for(const s of strands){
   s.core.visible=enter*fade>.0001;if(s.halo)s.halo.visible=s.core.visible;if(!s.core.visible)continue;
   s.su.opacity.value=enter*fade*(s.lane===1?.77:.36*(1-smooth(.35,.7,c)));s.su.phase.value=phase+s.band*.7+s.lane*2.7;s.su.convergence.value=c;
   const radius=(s.lane===1?.009:.004)*(1-.6*c);
   const pts=Array.from({length:N+1},(_,j)=>curve(s,j/N,t,c));
   for(let j=0;j<=N;j++){
    tangent.subVectors(pts[Math.min(N,j+1)],pts[Math.max(0,j-1)]).normalize();
    normal.crossVectors(tangent,Math.abs(tangent.z)>.9?yAxis:zAxis).normalize();binormal.crossVectors(tangent,normal).normalize();
    for(let k=0;k<R;k++){const a=k/R*Math.PI*2,ix=(j*R+k)*3;
     s.pos[ix]=pts[j].x+radius*(normal.x*Math.cos(a)+binormal.x*Math.sin(a));
     s.pos[ix+1]=pts[j].y+radius*(normal.y*Math.cos(a)+binormal.y*Math.sin(a));
     s.pos[ix+2]=pts[j].z+radius*(normal.z*Math.cos(a)+binormal.z*Math.sin(a));
    }
   }
   s.geometry.attributes.position.needsUpdate=true;
   if(s.halo){const hp=s.halo.geometry.attributes.position.array;
    for(let j=0;j<=N;j++)for(let k=0;k<R;k++){const ix=(j*R+k)*3;hp[ix]=pts[j].x+(s.pos[ix]-pts[j].x)*3.8;hp[ix+1]=pts[j].y+(s.pos[ix+1]-pts[j].y)*3.8;hp[ix+2]=pts[j].z+(s.pos[ix+2]-pts[j].z)*3.8;}
    s.halo.geometry.attributes.position.needsUpdate=true;s.halo.material.uniforms.opacity.value=enter*fade*.034;
   }
  }
  pm.opacity=enter*fade*.6;
  const pp=particleGeo.attributes.position.array;
  for(let i=0;i<30;i++){
   const s=strands[i];const u=1-((i*.173+phase*.025)%1);const p=curve(s,u,t,c);p.toArray(pp,i*3);
  }particleGeo.attributes.position.needsUpdate=true;
 }
 function draw(){
  const [w,h]=dimensions;
  camera.position.set(0,0,0);camera.rotation.set(view.pitch,view.yaw,0,'YXZ');camera.fov=58;camera.aspect=w/h;
  if(view.detail){camera.position.set(1.35,.3,-2.65);camera.lookAt(.35,0,-4.5);camera.fov=37;}
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);
  if(!view.stereo){renderer.render(scene,camera);return;}
  renderer.setScissorTest(true);
  for(const [eye,sign,index] of [[eyeL,-1,0],[eyeR,1,1]]){
   eye.copy(camera);eye.translateX(sign*.032);eye.aspect=(w/2)/h;eye.updateProjectionMatrix();renderer.setViewport(index*w/2,0,w/2,h);renderer.setScissor(index*w/2,0,w/2,h);renderer.render(scene,eye);
  }renderer.setScissorTest(false);
 }
 function renderAt(time){update(time);draw();}
 function resize(w,h){dimensions=[w,h];renderer.setSize(w,h,false);draw();}
 function setView(v){view={...view,...v};draw();}
 renderAt(0);
 return {renderAt,resize,setView,renderer,scene,camera,logo,info:()=>({time:lastTime,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,geometryVertices:geom.attributes.position.count,contours:logoContours.map(c=>c.length),projection:{fov:58,near:.05,logoDistance:4.5,logoDiameter:2.4},view}),getTime:()=>lastTime};
}
