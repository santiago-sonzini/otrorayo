Shader "Otrorayo/WelcomeGlass"
{
 Properties { _Opacity("Opacity",Range(0,1))=1 _Reveal("Assembly",Range(0,1))=1 _Dissolve("Disassembly",Range(0,1))=0 _Span("Half width",Float)=2.5 _Phase("Time",Float)=0 }
 SubShader {
  Tags {"Queue"="Transparent-10" "RenderType"="Transparent"}
  Blend SrcAlpha OneMinusSrcAlpha
  ZWrite On Cull Back
  Pass {
   CGPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #pragma target 3.0
   #pragma multi_compile_instancing
   #include "UnityCG.cginc"
   struct appdata {float4 vertex:POSITION;float3 normal:NORMAL;UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct v2f {float4 pos:SV_POSITION;float3 normal:TEXCOORD0;float3 world:TEXCOORD1;float3 local:TEXCOORD2;float face:TEXCOORD3;UNITY_VERTEX_OUTPUT_STEREO};
   float _Opacity,_Reveal,_Dissolve,_Span,_Phase;
   v2f vert(appdata v){v2f o;UNITY_SETUP_INSTANCE_ID(v);UNITY_INITIALIZE_OUTPUT(v2f,o);UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);o.pos=UnityObjectToClipPos(v.vertex);o.normal=UnityObjectToWorldNormal(v.normal);o.world=mul(unity_ObjectToWorld,v.vertex).xyz;o.local=v.vertex.xyz;o.face=abs(v.normal.z);return o;}
   fixed4 frag(v2f i):SV_Target {
    UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
    float progress=saturate((i.local.x+_Span)/(2*_Span));
    float reveal=smoothstep(progress-.1,progress+.1,_Reveal*1.2-.1);
    float dissolve=1-smoothstep(progress-.1,progress+.1,_Dissolve*1.2-.1);
    clip(reveal*dissolve-.005);
    float3 N=normalize(i.normal),V=normalize(_WorldSpaceCameraPos-i.world);
    float face=pow(i.face,16),fresnel=pow(1-saturate(abs(dot(N,V))),3);
    float3 R=reflect(-V,N);
    float softbox=pow(saturate(dot(R,normalize(float3(-.4,.8,-1)))),24);
    float sweep=pow(saturate(1-abs(i.local.x*.35+i.local.y*.55-sin(_Phase*.34)*1.4)),18);
    float3 edge=float3(.065,.115,.18)+float3(.32,.48,.68)*(fresnel*.7+softbox*.9);
    float3 spectral=.5+.5*cos(float3(0,2.1,4.2)+(i.local.x-i.local.y)*2.2);
    edge+=spectral*.08;
    float3 white=float3(.84,.9,.97)+sweep*.12+softbox*.08;
    return fixed4(lerp(edge,white,face),_Opacity*reveal*dissolve*lerp(.8,1,face));
   }
   ENDCG
  }
 }
 Fallback Off
}
