using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Rendering;

namespace Otrorayo.Quest
{
    // Native choreography sampled from show time. No camera motion or stateful simulation.
    public sealed class WelcomeSequence : MonoBehaviour
    {
        public const double VideoStartSeconds = 19;
        public const float FadeSeconds = 2;
        [Serializable] sealed class Geometry { public MeshData logo, title; public PathData[] logoPaths, titlePaths; }
        [Serializable] sealed class MeshData { public float[] positions, normals; public int[] triangles; }
        [Serializable] sealed class PathData { public float[] points; }
        const int Samples = 129, FragmentCount = 1800;
        readonly List<Material> materials = new List<Material>();
        readonly List<Mesh> meshes = new List<Mesh>();
        readonly List<LineRenderer> currents = new List<LineRenderer>();
        readonly List<LineRenderer> traces = new List<LineRenderer>();
        readonly Vector3[] curve = new Vector3[Samples];
        readonly Color[] palette = new Color[5];
        readonly Quaternion logoAngle = Quaternion.Euler(-2, -6, 0);
        static readonly string[] Palette = { "#ee3825", "#ff6b0b", "#fec306", "#77bd20", "#188ad9" };
        Geometry data;
        AudioSource introAudio;
        GameObject logo, title, fragments;
        Material logoMaterial, titleMaterial;
        Mesh fragmentMesh;
        Vector3[] origins, destinations, vertices;
        Color[] colors;

        public void Initialize()
        {
            if (data != null) return;
            data = JsonConvert.DeserializeObject<Geometry>(Resources.Load<TextAsset>("Welcome/geometry").text);
            for (int i = 0; i < 5; i++) ColorUtility.TryParseHtmlString(Palette[i], out palette[i]);
            logo = MakeMesh("OTRORAYO / optical glass", data.logo, new Vector3(0, 0, 4.5f), out logoMaterial);
            logo.transform.localRotation = logoAngle;
            title = MakeMesh("BIENVENIDO / Space Grotesk", data.title, new Vector3(0, 0, 4.2f), out titleMaterial);
            logoMaterial.SetFloat("_Span", 1.35f); titleMaterial.SetFloat("_Span", 2.5f);
            var light = new Material(Resources.Load<Shader>("Otrorayo/WelcomeLight")); materials.Add(light);
            for (int i = 0; i < 20; i++)
            {
                var obj = new GameObject("Continuous spectral current " + i); obj.transform.SetParent(transform, false);
                var line = obj.AddComponent<LineRenderer>();
                line.useWorldSpace = false; line.positionCount = Samples; line.sharedMaterial = light;
                line.textureMode = LineTextureMode.Stretch; line.numCapVertices = 6; line.numCornerVertices = 3;
                line.shadowCastingMode = ShadowCastingMode.Off; line.receiveShadows = false;
                line.widthCurve = new AnimationCurve(new Keyframe(0,.03f),new Keyframe(.12f,1),new Keyframe(.82f,.75f),new Keyframe(1,.02f));
                if(i<10)currents.Add(line);else traces.Add(line);
            }
            MakeFragments(light);
            introAudio = gameObject.AddComponent<AudioSource>();
            introAudio.playOnAwake = false; introAudio.spatialBlend = 0; introAudio.volume = .65f;
            introAudio.clip = Resources.Load<AudioClip>("Welcome/intro");
            gameObject.SetActive(false);
        }
        public void Align(Camera camera)
        {
            transform.position = camera.transform.position;
            transform.rotation = Quaternion.Euler(0, camera.transform.eulerAngles.y, 0);
        }
        static float Smooth(float a, float b, float t)
        {
            float v = Mathf.Clamp01((t-a)/(b-a)); return v*v*v*(v*(v*6-15)+10);
        }
        public void RenderAt(float t, float videoMix)
        {
            Initialize();
            if (videoMix >= .9999f) { gameObject.SetActive(false); return; }
            gameObject.SetActive(true);
            float opacity = 1-Mathf.Clamp01(videoMix);
            logo.SetActive(t > 7.8f && t < 13.6f);
            SetSurface(logoMaterial, Smooth(7.8f,9.1f,t), Smooth(11.9f,13.5f,t), opacity, t);
            title.SetActive(t > 14.2f);
            SetSurface(titleMaterial, Smooth(14.2f,16.2f,t), 0, opacity, t);
            // Continuous depth curves hand off to faithful contour tracing, without deforming the mark.
            float flowAlpha = Smooth(.5f,2.1f,t)*(1-Smooth(5.8f,7.5f,t))*opacity;
            float flowTime = Mathf.Min(t,6.7f);
            for (int i = 0; i < currents.Count; i++)
            {
                var line = currents[i]; line.enabled = flowAlpha > .001f; if (!line.enabled) continue;
                int side = i/5, band = i%5;
                for (int j = 0; j < Samples; j++)
                {
                    float u = j/(float)(Samples-1), z = Mathf.Lerp(2.8f,19,u);
                    float angle = (side==0 ? .55f : Mathf.PI+.55f)+.78f*Mathf.Sin(u*3.7f-flowTime*.36f)+u*1.4f+(band-2)*.038f;
                    float radius = 2.75f+.4f*Mathf.Sin(u*3.1f+.7f);
                    Vector3 flowing = new Vector3(Mathf.Cos(angle)*radius,Mathf.Sin(angle)*radius,z);
                    float gather=Smooth(4.8f,7.4f,t);
                    flowing.x*=1-gather*.55f;flowing.y*=1-gather*.55f;
                    curve[j] = flowing;
                }
                line.SetPositions(curve); line.widthMultiplier = .046f;
                Color color=palette[band];color.a=flowAlpha*.72f;line.startColor=line.endColor=color;
            }
            for(int i=0;i<traces.Count;i++)
            {
                var line=traces[i];int side=i/5,band=i%5;
                float drawn=Smooth(6.0f+band*.075f,8.5f+band*.075f,t);
                float traceAlpha=Smooth(6.0f,6.7f,t)*(1-Smooth(8.5f,9.4f,t))*opacity;
                line.enabled=traceAlpha>.001f;if(!line.enabled)continue;
                for(int j=0;j<Samples;j++)
                {
                    Vector3 point=Sample(data.logoPaths[side%data.logoPaths.Length],j/(float)(Samples-1)*drawn);
                    point*=1+(band-2)*.009f*(1-Smooth(8,9,t));
                    curve[j]=logoAngle*point+new Vector3(0,0,4.42f);
                }
                line.SetPositions(curve);line.widthMultiplier=.027f;
                Color color=Color.Lerp(palette[band],Color.white,Smooth(7.6f,8.8f,t)*.7f);
                color.a=traceAlpha*.6f;line.startColor=line.endColor=color;
            }
            RenderFragments(t,opacity);
        }
        static void SetSurface(Material material,float reveal,float dissolve,float opacity,float t)
        {
            material.SetFloat("_Reveal",reveal); material.SetFloat("_Dissolve",dissolve);
            material.SetFloat("_Opacity",opacity); material.SetFloat("_Phase",t);
        }
        // Match compact surface facets in horizontal order, never stretch whole unrelated outlines.
        void MakeFragments(Material material)
        {
            origins = SurfacePoints(data.logo,41); destinations = SurfacePoints(data.title,97);
            Array.Sort(origins,(a,b)=>SurfaceOrder(a,b,1.3f)); Array.Sort(destinations,(a,b)=>SurfaceOrder(a,b,2.5f));
            for(int i=0;i<FragmentCount;i++)
            {
                origins[i] = logoAngle*origins[i]+new Vector3(0,0,4.5f);
                destinations[i] += new Vector3(0,0,4.2f);
            }
            vertices = new Vector3[FragmentCount*4]; colors = new Color[vertices.Length];
            var uv = new Vector2[vertices.Length]; var indices = new int[FragmentCount*6];
            for(int i=0;i<FragmentCount;i++)
            {
                int k=i*4,q=i*6; uv[k]=new Vector2(0,0);uv[k+1]=new Vector2(1,0);uv[k+2]=new Vector2(1,1);uv[k+3]=new Vector2(0,1);
                indices[q]=k;indices[q+1]=k+1;indices[q+2]=k+2;indices[q+3]=k;indices[q+4]=k+2;indices[q+5]=k+3;
            }
            fragmentMesh = new Mesh { name="Batched travelling glass facets" };fragmentMesh.MarkDynamic();
            fragmentMesh.vertices=vertices;fragmentMesh.uv=uv;fragmentMesh.triangles=indices;fragmentMesh.colors=colors;
            fragmentMesh.bounds=new Bounds(new Vector3(0,0,4),new Vector3(8,6,6));meshes.Add(fragmentMesh);
            fragments=new GameObject("Logo to welcome / surface fragments");fragments.transform.SetParent(transform,false);
            fragments.AddComponent<MeshFilter>().sharedMesh=fragmentMesh;
            var renderer=fragments.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;
            renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;
        }
        void RenderFragments(float t,float opacity)
        {
            bool active=t>=11.6f&&t<16.4f;fragments.SetActive(active);if(!active)return;
            for(int i=0;i<FragmentCount;i++)
            {
                float rank=i/(float)(FragmentCount-1),delay=rank*.65f,p=Smooth(11.9f+delay,15.0f+delay,t);
                Vector3 a=origins[i],b=destinations[i];float arc=Mathf.Sin(p*Mathf.PI),lane=Mathf.Sin(i*2.39996f);
                Vector3 center=Vector3.Lerp(a,b,p)+new Vector3(0,arc*(.13f+lane*.13f),-arc*(.22f+.16f*rank));
                Vector3 direction=b-a+new Vector3(0,.1f,0);direction.z=0;direction.Normalize();if(direction.sqrMagnitude<.1f)direction=Vector3.right;
                Vector3 normal=new Vector3(-direction.y,direction.x,0);
                float size=.005f+.004f*(.5f+.5f*Mathf.Sin(i*7.13f));
                Vector3 along=direction*size*(1+arc*.85f),across=normal*size*.7f;int k=i*4;
                vertices[k]=center-along-across;vertices[k+1]=center+along-across;vertices[k+2]=center+along+across;vertices[k+3]=center-along+across;
                Color c=i%5==0?Color.Lerp(palette[(i/5)%5],Color.white,.25f):new Color(.82f,.92f,1);
                c.a=Smooth(11.6f+delay,12.1f+delay,t)*(1-Smooth(14.8f+delay,15.4f+delay,t))*opacity*.85f;
                colors[k]=colors[k+1]=colors[k+2]=colors[k+3]=c;
            }
            fragmentMesh.vertices=vertices;fragmentMesh.colors=colors;
        }
        static Vector3[] SurfacePoints(MeshData mesh,int seed)
        {
            var rng=new System.Random(seed);var faces=new List<int>();var areas=new List<float>();float total=0;
            for(int q=0;q<mesh.triangles.Length;q+=3)
            {
                int a=mesh.triangles[q],b=mesh.triangles[q+1],c=mesh.triangles[q+2];
                if(mesh.normals[a*3+2]>-.95f)continue;
                float area=Vector3.Cross(Vertex(mesh,b)-Vertex(mesh,a),Vertex(mesh,c)-Vertex(mesh,a)).magnitude*.5f;
                if(area<.0000001f)continue;total+=area;faces.Add(q);areas.Add(total);
            }
            if(faces.Count==0)throw new InvalidOperationException("Welcome mesh has no front surface");
            var result=new Vector3[FragmentCount];
            for(int i=0;i<result.Length;i++)
            {
                float pick=(float)rng.NextDouble()*total;int n=areas.BinarySearch(pick);if(n<0)n=~n;int q=faces[Mathf.Min(n,faces.Count-1)];
                float u=Mathf.Sqrt((float)rng.NextDouble()),v=(float)rng.NextDouble();
                result[i]=Vertex(mesh,mesh.triangles[q])*(1-u)+Vertex(mesh,mesh.triangles[q+1])*(u*(1-v))+Vertex(mesh,mesh.triangles[q+2])*(u*v);
            }
            return result;
        }
        static int SurfaceOrder(Vector3 a,Vector3 b,float span)
        {
            int columnA=Mathf.FloorToInt((a.x+span)/(2*span)*32),columnB=Mathf.FloorToInt((b.x+span)/(2*span)*32);
            return columnA==columnB?a.y.CompareTo(b.y):columnA.CompareTo(columnB);
        }
        static Vector3 Vertex(MeshData mesh,int index){int k=index*3;return new Vector3(mesh.positions[k],mesh.positions[k+1],mesh.positions[k+2]);}
        static Vector3 Sample(PathData path,float u)
        {
            float p=Mathf.Clamp01(u)*(path.points.Length/3-1);int a=Mathf.FloorToInt(p)*3,b=Mathf.Min(a+3,path.points.Length-3);
            return Vector3.Lerp(new Vector3(path.points[a],path.points[a+1],path.points[a+2]),new Vector3(path.points[b],path.points[b+1],path.points[b+2]),p-Mathf.Floor(p));
        }
        GameObject MakeMesh(string name,MeshData source,Vector3 position,out Material material)
        {
            var obj=new GameObject(name);obj.transform.SetParent(transform,false);obj.transform.localPosition=position;
            var mesh=new Mesh{name=name,indexFormat=IndexFormat.UInt32};var v=new Vector3[source.positions.Length/3];var normals=new Vector3[v.Length];
            for(int i=0;i<v.Length;i++){int k=i*3;v[i]=Vertex(source,i);normals[i]=new Vector3(source.normals[k],source.normals[k+1],source.normals[k+2]);}
            mesh.vertices=v;mesh.normals=normals;mesh.triangles=source.triangles;mesh.RecalculateBounds();meshes.Add(mesh);obj.AddComponent<MeshFilter>().sharedMesh=mesh;
            material=new Material(Resources.Load<Shader>("Otrorayo/WelcomeGlass"));materials.Add(material);
            var renderer=obj.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;return obj;
        }
        public void SetAudioPlaying(bool playing,float seconds)
        {
            if(introAudio==null||introAudio.clip==null)return;
            if(!playing||seconds>=21||!gameObject.activeInHierarchy){introAudio.Pause();return;}
            if(!introAudio.isPlaying||Mathf.Abs(introAudio.time-seconds)>.2f){introAudio.time=Mathf.Clamp(seconds,0,introAudio.clip.length-.01f);introAudio.Play();}
        }
        void OnDestroy(){foreach(var m in materials)Destroy(m);foreach(var m in meshes)Destroy(m);}
    }
}
