/* Native WebGL surface. One liquid volume, one camera for the whole page. */
(() => {
  "use strict";
  const vertex = `attribute vec2 position;
    void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision highp float;
    uniform vec2 resolution;
    uniform float phase;
    uniform float clock;
    uniform float opacity;
    uniform vec2 pointer;
    #define PI 3.14159265359
    vec2 center(float z){return vec2(sin(z*.115)*.7,cos(z*.09)*.4);}
    float surface(vec3 p){
      vec2 q=p.xy-center(p.z);
      float a=atan(q.y,q.x);
      float r=3.4+sin(p.z*.24+a*2.)*.42;
      r+=sin(a*3.-p.z*.29+clock*.07)*.24;
      r+=sin(a*7.+p.z*.63-clock*.06)*.055;
      return r-length(q);
    }
    vec3 normalAt(vec3 p){
      vec2 e=vec2(.007,0.);
      return normalize(vec3(surface(p+e.xyy)-surface(p-e.xyy),surface(p+e.yxy)-surface(p-e.yxy),surface(p+e.yyx)-surface(p-e.yyx)));
    }
    vec3 spectrum(float n){
      if(n<.5)return vec3(.93,.14,.08);
      if(n<1.5)return vec3(1.,.34,.025);
      if(n<2.5)return vec3(1.,.72,.018);
      if(n<3.5)return vec3(.39,.7,.07);
      return vec3(.035,.39,.85);
    }
    float angleDistance(float a,float b){return abs(atan(sin(a-b),cos(a-b)));}
    void main(){
      vec2 uv=(gl_FragCoord.xy-resolution*.5)/resolution.y;
      float mobile=step(resolution.x/resolution.y,.9);
      uv.x-=mix(.19,-.035,mobile)*sin(min(phase,1.)*PI*.5);
      uv.x+=sin(max(0.,phase-1.)*1.5)*.1;
      uv.y+=mix(.01,.17,mobile);
      float cameraZ=phase*8.;
      vec3 ro=vec3(center(cameraZ),cameraZ);
      ro.xy+=vec2(sin(phase*1.2)*.32,cos(phase)*.13)+pointer*.035;
      vec3 rd=normalize(vec3(uv,1.12));
      float yaw=sin(phase*1.35)*.1;
      rd.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*rd.xz;
      float roll=sin(phase*1.2)*.13;
      rd.xy=mat2(cos(roll),-sin(roll),sin(roll),cos(roll))*rd.xy;
      float depth=.1;
      for(int i=0;i<72;i++){
        float d=surface(ro+rd*depth);
        if(d<.007 || depth>65.)break;
        depth+=max(.004,d*.7);
      }
      vec3 col=vec3(0.);
      float alpha=0.;
      if(depth<65.){
        vec3 hit=ro+rd*depth;
        vec3 n=normalAt(hit);
        vec3 eye=-rd;
        vec3 light=normalize(vec3(-1.4,2.2,ro.z+7.)-hit);
        float spec=pow(max(0.,dot(n,normalize(light+eye))),64.);
        float wide=pow(max(0.,dot(n,normalize(light+eye))),7.);
        float fres=pow(1.-max(0.,dot(n,eye)),3.);
        float a=atan(hit.y-center(hit.z).y,hit.x-center(hit.z).x);
        float ribbons=sin(a*2.+hit.z*.24+clock*.035);
        float silver=pow(.5+.5*ribbons,24.);
        float fog=exp(-depth*.027);
        col=vec3(.008,.010,.013)*(.4+wide*.6);
        col+=vec3(.58,.66,.76)*(spec*.075+silver*.025+fres*.012);
        for(int i=0;i<5;i++){
          float f=float(i);
          float lane=.52+f*.045+sin(hit.z*.16)*.055;
          float distance=min(angleDistance(a,lane),angleDistance(a,lane-PI));
          float core=exp(-distance*distance*15500.);
          float bloom=exp(-distance*distance*550.);
          float glint=.2+.8*pow(.5+.5*sin(hit.z*.72+clock*.12+f*.35),10.);
          col+=spectrum(f)*(core*.24+bloom*.015)*glint;
        }
        col*=fog;
        col=pow(col,vec3(.88));
        alpha=opacity*(1.-smoothstep(42.,65.,depth));
      }
      gl_FragColor=vec4(col,alpha);
    }`;
  window.OtrorayoSpace = {
    create() {
      const canvas = document.createElement("canvas");
      canvas.id = "journey-surface";
      canvas.setAttribute("aria-hidden", "true");
      const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
      if (!gl) return null;
      const shader = (type, source) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          throw new Error("Surface shader unavailable");
        return s;
      };
      try {
        const program = gl.createProgram();
        gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
        gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW,
        );
        const pos = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        const uniforms = Object.fromEntries(
          ["resolution", "phase", "clock", "opacity", "pointer"].map((n) => [
            n,
            gl.getUniformLocation(program, n),
          ]),
        );
        document.body.insertBefore(
          canvas,
          document.querySelector("#journey-scene"),
        );
        let lost = false;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          lost = true;
          canvas.hidden = true;
        });
        return {
          render(phase, time, pointer, opacity) {
            if (lost) return false;
            canvas.hidden = opacity < 0.001;
            if (canvas.hidden) return true;
            const scale = Math.min(
              devicePixelRatio,
              innerWidth < 768 ? 1.5 : 1.25,
              1920 / innerWidth,
            );
            const w = Math.round(innerWidth * scale),
              h = Math.round(innerHeight * scale);
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
              gl.viewport(0, 0, w, h);
            }
            gl.uniform2f(uniforms.resolution, w, h);
            gl.uniform1f(uniforms.phase, phase);
            gl.uniform1f(uniforms.clock, time);
            gl.uniform1f(uniforms.opacity, opacity);
            gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            return true;
          },
          destroy() {
            canvas.remove();
            gl.getExtension("WEBGL_lose_context")?.loseContext();
          },
        };
      } catch {
        canvas.remove();
        return null;
      }
    },
  };
})();
