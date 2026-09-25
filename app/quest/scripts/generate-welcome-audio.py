"""Deterministic abstract air/low-tone sound, no voice or music. Peak below -16 dBFS."""
import sys, wave
from pathlib import Path
sys.path.insert(0,'/private/tmp/otrorayo-python-libs')
import numpy as np
rate=48000;t=np.arange(21*rate)/rate;rng=np.random.default_rng(221026)
def smooth(a,b):
 x=np.clip((t-a)/(b-a),0,1);return x*x*(3-2*x)
env=smooth(.7,3)*(1-smooth(8,10))
noise=rng.normal(0,1,len(t));air=np.convolve(noise,np.ones(18)/18,'same')
waveform=.055*env*np.sin(2*np.pi*(48*t+.55*t*t))+.075*air*env
for hit,amp,freq in [(9.3,.09,65),(15.8,.045,210)]:
 age=np.maximum(0,t-hit);waveform+=amp*np.sin(2*np.pi*freq*age)*np.exp(-age*2)*(t>=hit)*np.minimum(1,age/.08)
waveform*=1-smooth(19,21)
waveform=np.clip(waveform,-.15,.15)
stereo=np.stack([waveform, .96*waveform+.008*np.roll(air,240)*env],axis=1)
dest=Path(__file__).resolve().parents[1]/'Assets/OTRORAYO/Resources/Welcome/intro.wav'
with wave.open(str(dest),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes((stereo*32767).astype('<i2').tobytes())
