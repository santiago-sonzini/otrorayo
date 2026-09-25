from pathlib import Path
import json, math, wave
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
a = np.array(Image.open(ROOT/'assets/otrorayo-instagram.jpg').convert('L')) > 128
# Oriented pixel-boundary loops; no invented vector or replacement mark.
edges = {}
for y,x in np.argwhere(a):
    for valid,s,e in [(y==0 or not a[y-1,x],(x,y),(x+1,y)),(x==639 or not a[y,x+1],(x+1,y),(x+1,y+1)),(y==639 or not a[y+1,x],(x+1,y+1),(x,y+1)),(x==0 or not a[y,x-1],(x,y+1),(x,y))]:
        if valid: edges.setdefault(s,[]).append(e)
loops=[]
while edges:
    start=next(iter(edges)); p=start; points=[]
    while True:
        points.append(p); q=edges[p].pop()
        if not edges[p]: del edges[p]
        p=q
        if p==start: break
    if len(points)>80: loops.append(points)
def rdp(p,eps):
    if len(p)<3:return p
    b=p[-1]-p[0]; l=np.linalg.norm(b)
    d=np.abs(b[0]*(p[:,1]-p[0,1])-b[1]*(p[:,0]-p[0,0]))/(l or 1)
    i=int(np.argmax(d))
    if d[i]>eps: return np.concatenate((rdp(p[:i+1],eps)[:-1],rdp(p[i:],eps)))
    return p[[0,-1]]
contours=[]
for points in loops:
    p=np.array(points,dtype=float)-.5
    p=(np.roll(p,1,axis=0)+2*p+np.roll(p,-1,axis=0))/4
    mid=len(p)//2
    p=np.concatenate((rdp(p[:mid+1],.55)[:-1],rdp(np.concatenate((p[mid:],p[:1])),.55)[:-1]))
    contours.append(np.round(p,3).tolist())
(ROOT/'assets/logo-contours.js').write_text('export const logoContours = '+json.dumps(contours)+';\n')
(ROOT/'assets/logo-contours.json').write_text(json.dumps({'source':'otrorayo-instagram.jpg','threshold':128,'simplifyTolerancePx':.55,'contours':contours},indent=2))
print('Original-source contours:',[len(c) for c in contours])
# Original sound design: quiet bass, filtered-air layers, restrained assembly impact.
sr=48000; dur=27; t=np.arange(sr*dur)/sr; u=np.maximum(0,t-3)
def smooth(lo,hi,x):
    v=np.clip((x-lo)/(hi-lo),0,1);return v*v*(3-2*v)
rng=np.random.default_rng(20260922)
noise=rng.normal(size=len(t)); freq=np.fft.rfftfreq(len(t),1/sr)
spectrum=np.fft.rfft(noise)
air=np.fft.irfft(spectrum*np.exp(-((freq-1450)/950)**2),n=len(t));air/=max(np.std(air),1e-6)
low=np.sin(2*np.pi*(49*u+.52*u*u))*.45+np.sin(2*np.pi*98*u)*.12
env=smooth(1.1,5,u)*(1-smooth(15.5,20.8,u))
mono=low*.15*env+air*.014*env*(.3+.7*smooth(2,12,u))
left=mono.copy();right=mono.copy()
for k,f in enumerate([220,261.63,293.66,329.63,392]):
    dt=np.maximum(0,u-(4+k*2.25)); gate=(u>4+k*2.25)*np.exp(-dt*2.1)*(1-np.exp(-dt*10))
    tone=np.sin(2*np.pi*(f*dt+8*np.log1p(dt)))*.032*gate
    left+=tone*(.8-k*.09);right+=tone*(.44+k*.09)
dt=np.maximum(0,u-18.3); gate=(u>=18.3)
impact=(np.sin(2*np.pi*(65*dt+18*(1-np.exp(-dt*4))))*.23*np.exp(-dt*2.4)+np.sin(2*np.pi*523.25*dt)*.048*np.exp(-dt*1.3)+air*.013*np.exp(-dt*10))*gate*smooth(0,.012,dt)
left+=impact;right+=impact
fade=1-smooth(22,24,u); sound=np.stack((left,right),axis=1)*fade[:,None]
sound[t<3]=0
peak=np.max(np.abs(sound));sound*=min(1,.48/peak)
with wave.open(str(ROOT/'assets/sound-design.wav'),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((sound*32767).astype('<i2').tobytes())
print('Audio: 27s, stereo 48 kHz; peak',float(np.max(np.abs(sound))))
