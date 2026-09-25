import fs from 'node:fs';
import * as THREE from '../../../videos/quest-welcome/vendor/three.module.js';
import {logoContours} from '../../../videos/quest-welcome/assets/logo-contours.js';
const font=JSON.parse(fs.readFileSync(new URL('welcome-font-outlines.json',import.meta.url)));
const logo=logoContours.map(c=>{const s=new THREE.Shape();c.forEach(([x,y],i)=>s[i?'lineTo':'moveTo']((x-319.5)*2.4/350,(319.5-y)*2.4/350));s.closePath();return s;});
function textShapes(text,width,y){
 const tracking=20,total=[...text].reduce((a,c)=>a+font[c].advance+tracking,0)-tracking,scale=width/total;
 let x=-width/2;const shapes=[];
 for(const c of text){const glyph=font[c],p=new THREE.ShapePath();for(const [op,...v] of glyph.commands){const vals=v.map((q,i)=>q*scale+(i%2?y:x));if(op==='M')p.moveTo(...vals);if(op==='L')p.lineTo(...vals);if(op==='Q')p.quadraticCurveTo(...vals);if(op==='C')p.bezierCurveTo(...vals);if(op==='Z')p.currentPath.closePath();}shapes.push(...p.toShapes());x+=(glyph.advance+tracking)*scale;}
 return shapes;
}
const title=[...textShapes('BIENVENIDO',4.8,-.05),...textShapes('A OTRORAYO',1.9,-.63)];
function pack(shapes,depth,bevel){
 const g=new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel*.6,bevelSegments:3,curveSegments:8,steps:1});g.translate(0,0,-depth/2);
 const a=g.attributes.position.array,n=g.attributes.normal.array,positions=[],normals=[],triangles=[];
 for(let i=0;i<a.length;i+=3){positions.push(+a[i].toFixed(6),+a[i+1].toFixed(6),+(-a[i+2]).toFixed(6));normals.push(+n[i].toFixed(6),+n[i+1].toFixed(6),+(-n[i+2]).toFixed(6));}
 for(let i=0;i<a.length/3;i+=3)triangles.push(i,i+2,i+1);
 return{positions,normals,triangles};
}
function paths(shapes){return shapes.flatMap(s=>[s,...s.holes].map(p=>({points:p.getSpacedPoints(96).flatMap(q=>[+q.x.toFixed(6),+q.y.toFixed(6),0])})));}
const result={logo:pack(logo,.13,.012),title:pack(title,.105,.008),logoPaths:paths(logo),titlePaths:paths(title)};
const dest=new URL('../Assets/OTRORAYO/Resources/Welcome/geometry.json',import.meta.url);fs.writeFileSync(dest,JSON.stringify(result));
console.log(JSON.stringify({logoTriangles:result.logo.triangles.length/3,titleTriangles:result.title.triangles.length/3,titleContours:result.titlePaths.length}));
