Shader "Otrorayo/Equirectangular"
{
    Properties
    {
        _MainTex ("Decoded video", 2D) = "black" {}
        _Exposure ("Fade from black", Range(0,1)) = 0
        _Projection180 ("180 degree hemisphere", Float) = 0
        _StereoLayout ("0 mono, 1 top-bottom, 2 side-by-side", Float) = 0
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Opaque" }
        Cull Front ZWrite Off ZTest LEqual
        Pass
        {
            CGPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };
            struct v2f
            {
                float4 vertex : SV_POSITION;
                float3 direction : TEXCOORD0;
                UNITY_VERTEX_OUTPUT_STEREO
            };
            sampler2D _MainTex;
            float4 _MainTex_TexelSize;
            float _Projection180;
            float _Exposure;
            float _StereoLayout;

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
                float yaw = atan2(direction.x, direction.z);
                const float pi = 3.14159265359;
                // The unfilmed hemisphere of 180 footage is black, never repeated.
                if (_Projection180 > 0.5 && abs(yaw) > pi * 0.5)
                    return fixed4(0, 0, 0, 1);

                float2 uv = float2(yaw / (pi * lerp(2.0, 1.0, _Projection180)) + 0.5,
                                   asin(clamp(direction.y, -1.0, 1.0)) / pi + 0.5);
                float eye = unity_StereoEyeIndex;

                float2 scale = float2(1.0, 1.0);
                float2 offset = float2(0.0, 0.0);
                if (_StereoLayout > 1.5)
                {
                    scale.x = 0.5;
                    offset.x = eye * 0.5;
                }
                else if (_StereoLayout > 0.5)
                {
                    // Standard over-under: left eye on top, right eye on bottom.
                    scale.y = 0.5;
                    offset.y = (1.0 - eye) * 0.5;
                }
                uv = uv * scale + offset;
                // Never filter across the boundary between packed eyes.
                float2 inset = abs(_MainTex_TexelSize.xy) * 0.5;
                uv = clamp(uv, offset + inset, offset + scale - inset);
                // This is the decoder's ordinary 2D texture, not an XR screen texture array.
                return fixed4(tex2D(_MainTex, uv).rgb * _Exposure, 1.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
