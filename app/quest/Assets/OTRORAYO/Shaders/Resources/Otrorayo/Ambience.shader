Shader "Otrorayo/Ambience"
{
    Properties
    {
        _Tint ("Horizon tint", Color) = (0.1, 0.7, 0.8, 1)
        _Preset ("0 orbit, 1 aurora, 2 minimal", Float) = 0
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Opaque" }
        Cull Front ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            struct appdata { float4 vertex : POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 vertex : SV_POSITION; float3 direction : TEXCOORD0; UNITY_VERTEX_OUTPUT_STEREO };
            fixed4 _Tint;
            float _Preset;
            v2f vert(appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.direction = v.vertex.xyz;
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
                float3 direction = normalize(i.direction);
                float y = direction.y;
                float horizon = pow(saturate(1.0 - abs(y + 0.12)), 9.0);
                float ceiling = saturate(y) * 0.01;
                float glow = horizon * 0.075 + ceiling;
                if (_Preset > 0.5 && _Preset < 1.5)
                {
                    float ribbon = y - 0.3 - sin(direction.x * 4.0 + _Time.y * 0.035) * 0.12;
                    glow += exp(-ribbon * ribbon * 65.0) * (0.045 + 0.015 * sin(direction.z * 9.0));
                }
                if (_Preset > 1.5) glow *= 0.35;
                return fixed4(float3(0.006, 0.008, 0.015) + _Tint.rgb * glow, 1);
            }
            ENDCG
        }
    }
    Fallback Off
}
