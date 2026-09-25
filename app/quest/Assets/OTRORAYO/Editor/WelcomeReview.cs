using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace Otrorayo.Quest.Editor
{
    public static class WelcomeReview
    {
        const string Output = "Builds/welcome-review/revision-02";
        static Camera camera;
        static WelcomeSequence sequence;
        static RenderTexture target;
        static Texture2D image;
        static void Setup(int width,int height)
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            camera=new GameObject("Review camera").AddComponent<Camera>();
            camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=Color.black;camera.fieldOfView=64;
            camera.nearClipPlane=.05f;camera.farClipPlane=50;camera.allowHDR=false;camera.allowMSAA=true;
            sequence=new GameObject("Native welcome review").AddComponent<WelcomeSequence>();sequence.Initialize();sequence.Align(camera);
            Directory.CreateDirectory(Output);
            target=new RenderTexture(width,height,24,RenderTextureFormat.ARGB32){antiAliasing=4};camera.targetTexture=target;
            image=new Texture2D(width,height,TextureFormat.RGB24,false);
        }
        static byte[] Frame(float t)
        {
            sequence.RenderAt(t,0);camera.Render();RenderTexture.active=target;
            image.ReadPixels(new Rect(0,0,target.width,target.height),0,0);image.Apply();return image.EncodeToPNG();
        }
        static void Cleanup()
        {
            RenderTexture.active=null;camera.targetTexture=null;target.Release();
            UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(sequence.gameObject);UnityEngine.Object.DestroyImmediate(camera.gameObject);
        }
        public static void Capture()
        {
            Setup(1920,1080);
            try {
                foreach(float t in new[]{0f,2.5f,5.5f,7.5f,10.5f,12.5f,13.5f,14.5f,15.5f,17.5f})
                    File.WriteAllBytes(Output+"/frame-"+t.ToString("0.0",System.Globalization.CultureInfo.InvariantCulture)+".png",Frame(t));
                // Rendering a previous pose after seeking must be pixel-identical.
                byte[] a=Frame(13.5f);Frame(17.5f);byte[] b=Frame(13.5f);
                if(Convert.ToBase64String(a)!=Convert.ToBase64String(b))throw new Exception("Welcome pose changed after a seek");
                Debug.Log("PASS: native welcome stills; deterministic pose after seek");
            } finally { Cleanup(); }
        }
        public static void CaptureAnimation()
        {
            Setup(1280,720);Directory.CreateDirectory(Output+"/motion");
            try {
                for(int frame=0;frame<570;frame++)File.WriteAllBytes(Output+"/motion/"+frame.ToString("D4")+".png",Frame(frame/30f));
                Debug.Log("PASS: native welcome animation captured / 19s / 30fps");
            } finally { Cleanup(); }
        }
        public static void CaptureAll(){Capture();CaptureAnimation();}
    }
}
