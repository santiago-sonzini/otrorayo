from pathlib import Path
import sys,json
sys.path.insert(0,'/private/tmp/otrorayo-python-libs')
from shapely.geometry import Point,Polygon
from shapely import intersects_xy
import numpy as np
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
# Source-measured circles and straight blade edges; boolean union removes internal seams.
center=(319.5,319.5)
ring=Point(center).buffer(175.3,quad_segs=128).difference(Point(center).buffer(161.4,quad_segs=128))
a=ring.intersection(Polygon([(-1000,-1010),(2000,-1010),(2000,1990)]))
b=ring.intersection(Polygon([(-1000,-990),(-1000,2000),(1990,2000)]))
a=a.union(Polygon([(177.5,147.5),(339,309),(329,319),(167.5,157.5)]))
b=b.union(Polygon([(310,320),(472,482),(462,492),(300,330)]))
contours=[]
for p in [a,b]:
 assert p.geom_type=='Polygon',p.geom_type
 contours.append([[round(x,5),round(y,5)] for x,y in list(p.exterior.coords)[:-1]])
source=np.array(Image.open(root/'assets/otrorayo-instagram.jpg').convert('L'))>128
im=Image.new('L',(640*4,640*4));d=ImageDraw.Draw(im)
for c in contours:d.polygon([(x*4,y*4)for x,y in c],fill=255)
y,x=np.indices(source.shape)
mask=intersects_xy(a.union(b),x,y)
iou=float((mask&source).sum()/(mask|source).sum())
(root/'assets/logo-contours.js').write_text('export const logoContours = '+json.dumps(contours)+';\n')
(root/'assets/logo-clean-fit.json').write_text(json.dumps({'source':'otrorayo-instagram.jpg','method':'Measured circle/line fit with boolean union; analytic curves remove raster stair steps','center':center,'outerRadius':175.3,'innerRadius':161.4,'binaryMaskIoU':iou,'vertices':[len(c)for c in contours]},indent=2))
print('Clean geometry vertices', [len(c)for c in contours], 'source IoU',round(iou,5))
