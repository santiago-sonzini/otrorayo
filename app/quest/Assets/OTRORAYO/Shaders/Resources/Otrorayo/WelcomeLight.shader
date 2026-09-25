Shader "Otrorayo/WelcomeLight"
{
 SubShader {
  Tags { "Queue"="Transparent+5" "RenderType"="Transparent" }
  Blend SrcAlpha One
  Cull Off ZWrite Off
  Pass {
   CGPROGRAM
   #pragma target 3.0
   #pragma vertex vert
   #pragma fragment frag
   #pragma multi_compile_instancing
   #include "UnityCG.cginc"
   struct appdata {float4 vertex:POSITION;float2 uv:TEXCOORD0;float4 color:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct v2f {float4 pos:SV_POSITION;float2 uv:TEXCOORD0;float4 color:COLOR;UNITY_VERTEX_OUTPUT_STEREO};
   v2f vert(appdata v){v2f o;UNITY_SETUP_INSTANCE_ID(v);UNITY_INITIALIZE_OUTPUT(v2f,o);UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);o.pos=UnityObjectToClipPos(v.vertex);o.uv=v.uv;o.color=v.color;return o;}
   fixed4 frag(v2f i):SV_Target {
    UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
    float across=abs(i.uv.y*2-1),core=exp2(-across*across*42),halo=exp2(-across*across*5)*.18;
    float ends=smoothstep(0,.045,i.uv.x)*(1-smoothstep(.955,1,i.uv.x));
    return fixed4(lerp(i.color.rgb,float3(1,1,1),core*.18),i.color.a*(core+halo)*ends);
   }
   ENDCG
  }
 }
 Fallback Off
}
