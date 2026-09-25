"""Extract the supplied Space Grotesk outlines; no substitute system font."""
import json, sys
from pathlib import Path
sys.path.insert(0, '/private/tmp/otrorayo-font-tools')
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.basePen import BasePen
root=Path(__file__).resolve().parents[3]
f=TTFont(root/'landing/assets/fonts/space-grotesk-latin.woff2')
if 'fvar' in f:
 from fontTools.varLib.instancer import instantiateVariableFont
 f=instantiateVariableFont(f,{'wght':500},inplace=False)
gs=f.getGlyphSet(); cmap=f.getBestCmap()
class OutlinePen(BasePen):
 def __init__(self): super().__init__(gs); self.commands=[]
 def _moveTo(self,p): self.commands.append(['M',*p])
 def _lineTo(self,p): self.commands.append(['L',*p])
 def _qCurveToOne(self,p1,p2): self.commands.append(['Q',*p1,*p2])
 def _curveToOne(self,p1,p2,p3): self.commands.append(['C',*p1,*p2,*p3])
 def _closePath(self): self.commands.append(['Z'])
 def _endPath(self): pass
out={}
for c in set('BIENVENIDO A OTRORAYO'):
 name=cmap[ord(c)]; pen=OutlinePen(); gs[name].draw(pen)
 out[c]={'advance':f['hmtx'][name][0],'commands':pen.commands}
(root/'app/quest/scripts/welcome-font-outlines.json').write_text(json.dumps(out))
