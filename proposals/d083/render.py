"""Local offline orthographic z-buffer render of the exported D083 triangle records.

No browser, WebGL, remote CI, image generation or reference-image assets are used.
This is an actual mesh preview, explicitly separate from in-game acceptance.
"""
import json,math,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output';PREVIEW=OUT/'preview';PREVIEW.mkdir(parents=True,exist_ok=True)
MODELS=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(OUT.glob('0*.json'))]
LIGHT=np.array([-.6,.9,.45]);LIGHT/=np.linalg.norm(LIGHT)
BG=np.array([247,244,237],dtype=float)
FONT_DIR=Path('C:/Windows/Fonts')
def font(n,bold=False):
    p=FONT_DIR/('segoeuib.ttf' if bold else 'segoeui.ttf')
    return ImageFont.truetype(str(p),n)

def camera(yaw,elev):
    y,e=math.radians(yaw),math.radians(elev)
    view=np.array([math.sin(y)*math.cos(e),math.sin(e),math.cos(y)*math.cos(e)])
    right=np.array([math.cos(y),0,-math.sin(y)]);up=np.cross(view,right)
    return np.array([right,up,view])

def raster(tri,color,pixels,depth):
    h,w=depth.shape
    x0=max(0,int(np.floor(tri[:,0].min())));x1=min(w-1,int(np.ceil(tri[:,0].max())))
    y0=max(0,int(np.floor(tri[:,1].min())));y1=min(h-1,int(np.ceil(tri[:,1].max())))
    if x0>x1 or y0>y1:return
    a,b,c=tri;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-10:return
    xx,yy=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
    p=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
    q=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
    r=1-p-q;z=p*a[2]+q*b[2]+r*c[2]
    db=depth[y0:y1+1,x0:x1+1];mask=(p>=-1e-8)&(q>=-1e-8)&(r>=-1e-8)&(z>db)
    db[mask]=z[mask];pixels[y0:y1+1,x0:x1+1][mask]=color

def render(model,yaw,elev,W=1200,H=1000):
    S=1.5;w,h=int(W*S),int(H*S);matrix=camera(yaw,elev)
    # All eight use the same parcel coordinates and camera scale. Fit includes the actual sail tips.
    scale=min(w/1.96,h/1.67);center=np.array([.5,.39,.5])
    def project(p):
        a=(np.asarray(p)-center)@matrix.T
        return np.stack([w*.5+a[:,0]*scale,h*.52-a[:,1]*scale,a[:,2]],axis=1)
    pixels=np.broadcast_to(BG,(h,w,3)).copy();depth=np.full((h,w),-np.inf)
    ground=np.array([[-.06,-.009,-.06],[1.06,-.009,-.06],[1.06,-.009,1.06],[-.06,-.009,1.06]])
    g=project(ground)
    for ids in [(0,1,2),(0,2,3)]:raster(g[list(ids)],np.array([228,224,211]),pixels,depth)
    # True projected mesh shadows on the neutral display parcel; no silhouette sprites.
    shadow=Image.new('L',(w,h),0);sd=ImageDraw.Draw(shadow)
    for t in model['triangles']:
        p=np.array(t['p']);q=p.copy();q[:,0]-=(p[:,1]+.008)*LIGHT[0]/LIGHT[1];q[:,2]-=(p[:,1]+.008)*LIGHT[2]/LIGHT[1];q[:,1]=-.007
        uv=project(q);sd.polygon([(float(x),float(y)) for x,y,_ in uv],fill=38)
    sh=np.array(shadow)/255
    groundmask=depth>-np.inf;pixels[groundmask]*=(1-sh[groundmask,None]*.64)
    view=matrix[2];bounds=[]
    for t in model['triangles']:
        p=np.asarray(t['p']);n=np.asarray(t['n']);pr=project(p);bounds.extend(pr[:,:2].tolist())
        if np.dot(n,view)<=1e-10:continue
        c=np.array([int(t['color'][i:i+2],16) for i in [1,3,5]],dtype=float)
        shade=.68+.32*max(0,float(np.dot(n,LIGHT)))
        raster(pr,np.clip(c*shade,0,255),pixels,depth)
    bounds=np.array(bounds);assert bounds[:,0].min()>0 and bounds[:,0].max()<w and bounds[:,1].min()>0 and bounds[:,1].max()<h,'all actual model vertices fit'
    image=Image.fromarray(np.uint8(np.clip(pixels,0,255))).resize((W,H),Image.Resampling.LANCZOS)
    return image,{'yawDegrees':yaw,'elevationDegrees':elev,'projection':'orthographic CPU triangle z-buffer','sameParcelScale':True,'allVerticesInsideImage':True,'worldPixelScale':scale/S,'sourceModelFileSha256':hashlib.sha256((OUT/(model['id']+'.json')).read_bytes()).hexdigest()}

records=[]
VIEWS=[('front',35,28),('rear',215,28),('elevation',0,3)]
for view,yaw,elev in VIEWS:
    images=[]
    for m in MODELS:
        im,cam=render(m,yaw,elev);file=f"{m['id']}-{view}.png";im.save(PREVIEW/file)
        records.append({'file':file,'design':m['id'],'view':view,'width':im.width,'height':im.height,'camera':cam,'sha256':hashlib.sha256((PREVIEW/file).read_bytes()).hexdigest()});images.append((m,im))
        print('RENDER',file,flush=True)
    if view!='elevation':
        W,H=2400,1450;board=Image.new('RGB',(W,H),'#f7f4ed');d=ImageDraw.Draw(board)
        d.text((76,46),'GLIMMERTOWN  /  BRITISH WORKING LANDSCAPE',font=font(27,True),fill='#46665c')
        d.text((73,91),'Eight new architectural studies',font=font(52,True),fill='#292d2c')
        d.text((77,162),f'D083  /  LOCAL DESIGN PREVIEW  /  {"FRONT THREE-QUARTER" if view=="front" else "REAR THREE-QUARTER"}',font=font(22),fill='#6d716c')
        for i,(m,im) in enumerate(images):
            x=60+(i%4)*570;y=225+(i//4)*560
            board.paste(im.resize((555,462),Image.Resampling.LANCZOS),(x,y))
            d.text((x+20,y+455),f'{i+1:02d}   {m["name"]}',font=font(24,True),fill='#303631')
            labels=['Raised timber / staddle stones','Stone cylinder / slate cap','Glazed operating floor / stairs','Faceted lodge / radial roof','Tapered tower / lattice sails','Cart doors / off-centre stack','Aisled range / wagon porch','Open ironwork / domed canopy']
            d.text((x+20,y+492),labels[i],font=font(18),fill='#70776e')
        d.line((78,H-70,W-78,H-70),fill='#d4d8ca',width=2)
        d.text((78,H-53),'Actual procedural meshes. CPU preview; game WebGL, slot assignment and release validation remain pending.',font=font(18),fill='#70776e')
        file=f'd083-eight-{view}-board.png';board.save(PREVIEW/file);records.append({'file':file,'view':view,'width':W,'height':H,'sha256':hashlib.sha256((PREVIEW/file).read_bytes()).hexdigest()});print('BOARD',file,flush=True)
(PREVIEW/'manifest.json').write_text(json.dumps({'qualification':'Actual local mesh rendering with the same model triangles as GLB exports. No browser/WebGL capture or in-game acceptance claimed. No downloaded visual assets.','records':records},indent=2),encoding='utf-8')
print('DONE',len(records),'PNG previews',flush=True)
