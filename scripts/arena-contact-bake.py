"""Append HitFrontFast and bake fitted, posed collision boxes. No source asset edits.

Run with the bundled numpy Python. --package copies the inspected staged packs.
Box groups follow dominant skin joints; every fitted vertex is enclosed. Runtime
uses the same 12 cm scale, +Z forward, and host-owned facing/lift as the renderer.
"""
import argparse, copy, hashlib, json, struct, shutil
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/arena'
SCALE = .12 / 1.59857170559
DTYPES = {5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTHS = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def parse(path):
    b=path.read_bytes(); n=struct.unpack_from('<I',b,12)[0]
    size=struct.unpack_from('<I',b,20+n)[0]
    return json.loads(b[20:20+n]), b[28+n:28+n+size]
def accessor(d,b,index):
    a=d['accessors'][index];v=d['bufferViews'][a['bufferView']]
    dtype=np.dtype(DTYPES[a['componentType']]);w=WIDTHS[a['type']]
    result=np.ndarray((a['count'],w),dtype=dtype,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dtype.itemsize*w),dtype.itemsize)).astype(float)
    if a.get('normalized'): result/=np.iinfo(dtype).max
    return result
def slerp(a,b,t):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);dot=np.dot(a,b)
    if dot<0:b=-b;dot=-dot
    if dot>.9995:q=(1-t)*a+t*b
    else:
        angle=np.arccos(np.clip(dot,-1,1));q=(np.sin((1-t)*angle)*a+np.sin(t*angle)*b)/np.sin(angle)
    return q/np.linalg.norm(q)
def rotation(q):
    x,y,z,w=q/np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)], [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)], [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def quaternion(m):
    # Largest diagonal branch avoids instability at 180 degrees.
    vals=np.array([1+m[0,0]-m[1,1]-m[2,2],1-m[0,0]+m[1,1]-m[2,2],1-m[0,0]-m[1,1]+m[2,2],1+np.trace(m)])
    i=int(np.argmax(vals));s=2*np.sqrt(max(0,vals[i]));q=np.zeros(4);q[i]=s/4
    if i==3:q[:3]=[m[2,1]-m[1,2],m[0,2]-m[2,0],m[1,0]-m[0,1]];q[:3]/=s
    elif i==0:q[1:]=[m[0,1]+m[1,0],m[0,2]+m[2,0],m[2,1]-m[1,2]];q[1:]/=s
    elif i==1:q[[0,2,3]]=[m[0,1]+m[1,0],m[1,2]+m[2,1],m[0,2]-m[2,0]];q[[0,2,3]]/=s
    else:q[[0,1,3]]=[m[0,2]+m[2,0],m[1,2]+m[2,1],m[1,0]-m[0,1]];q[[0,1,3]]/=s
    return q/np.linalg.norm(q)
def tracks(d,b,animation):
    return {(ch['target']['node'],ch['target']['path']):(accessor(d,b,animation['samplers'][ch['sampler']]['input'])[:,0],accessor(d,b,animation['samplers'][ch['sampler']]['output'])) for ch in animation['channels']}
def sample(ts,ys,t,path):
    hi=min(len(ts)-1,int(np.searchsorted(ts,t,side='right')));lo=max(0,hi-1)
    f=float(np.clip((t-ts[lo])/(ts[hi]-ts[lo]),0,1)) if hi!=lo else 0
    return slerp(ys[lo],ys[hi],f) if path=='rotation' else (1-f)*ys[lo]+f*ys[hi]
def append_fast(d,b):
    doc=copy.deepcopy(d);binary=bytearray(b)
    source=tracks(d,b,next(a for a in d['animations'] if a['name']=='HitFront'))
    idle=tracks(d,b,next(a for a in d['animations'] if a['name']=='IdleAggro'))
    anim={'name':'HitFrontFast','channels':[],'samplers':[]};timeline=np.arange(13,dtype='<f4')/60
    for (node,path),(ts,ys) in source.items():
        values=[]
        for t in timeline:
            pose=sample(ts,ys,float(t)/.2*.57,path)
            blend=float(np.clip((float(t)-.15)/.05,0,1))
            its,iys=idle[node,path];end=sample(its,iys,0,path)
            values.append(slerp(pose,end,blend) if path=='rotation' else (1-blend)*pose+blend*end)
        outputs=np.array(values,dtype='<f4');sampler={'interpolation':'LINEAR'}
        for key,arr,kind in [('input',timeline.reshape(-1,1),'SCALAR'),('output',outputs,{'translation':'VEC3','rotation':'VEC4','scale':'VEC3'}[path])]:
            binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);payload=arr.tobytes();binary.extend(payload)
            view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(payload)})
            a={'bufferView':view,'componentType':5126,'count':len(arr),'type':kind}
            if key=='input':a.update(min=[0],max=[float(timeline[-1])])
            sampler[key]=len(doc['accessors']);doc['accessors'].append(a)
        anim['channels'].append({'sampler':len(anim['samplers']),'target':{'node':node,'path':path}});anim['samplers'].append(sampler)
    doc['animations'].append(anim);doc['buffers'][0]['byteLength']=len(binary)
    jb=json.dumps(doc,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4);binary.extend(b'\0'*(-len(binary)%4))
    result=struct.pack('<III',0x46546c67,2,28+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary
    assert doc['animations'][:-1]==d['animations'] and binary[:len(b)]==b
    return result

class Baker:
    def __init__(self,d,b):
        self.d=d;self.b=b;self.parents={c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])}
        self.joints=d['skins'][0]['joints'];self.names=[d['nodes'][i]['name'] for i in self.joints]
        self.ibms=accessor(d,b,d['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        points=[];weights=[];joints=[]
        for mesh in d['meshes']:
            # LED fallback duplicates the suit vertices.
            if mesh.get('name','').startswith('Mike_Body_LED'):continue
            for p in mesh['primitives']:
                a=p['attributes'];xyz=accessor(d,b,a['POSITION']);points.append(np.column_stack((xyz,np.ones(len(xyz)))))
                weights.append(accessor(d,b,a['WEIGHTS_0']));joints.append(accessor(d,b,a['JOINTS_0']).astype(int))
        self.points=np.concatenate(points);self.weights=np.concatenate(weights);self.vertex_joints=np.concatenate(joints)
        dominant=self.vertex_joints[np.arange(len(self.weights)),self.weights.argmax(axis=1)]
        self.groups={}
        for name in ['pelvis','spine_01','spine_02','spine_03','head_01','upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r']:
            self.groups[name]=[]
        for i,j in enumerate(dominant):
            name=self.names[j]
            if j<=39:group='head_01' if j>=6 else name
            elif 43<=j<=54:group='hand_l'
            elif 58<=j<=69:group='hand_r'
            elif name=='ball_l':group='foot_l'
            elif name=='ball_r':group='foot_r'
            elif name.startswith('clavicle'):group='spine_03'
            else:group=name
            if group in self.groups:self.groups[group].append(i)
        self.groups={k:np.array(v) for k,v in self.groups.items() if v}
        self.node_by_name={n['name']:i for i,n in enumerate(d['nodes']) if 'name' in n}
        self.pose({},0)
        for hand in ['l','r']:
            node=self.node_by_name['hand_'+hand]
            origin=self.last_world[node][:3,3]*SCALE
            forearm=self.groups['lowerarm_'+hand]
            # The gauntlet spans a skin-joint boundary. Include only the distal
            # 17.5 mm of the forearm mesh, excluding the elbow/upper arm.
            wrist=forearm[np.linalg.norm(self.last_xyz[forearm]-origin,axis=1)<=.0175]
            self.groups['glove_'+hand]=np.concatenate((self.groups['hand_'+hand],wrist))
            self.node_by_name['glove_'+hand]=node
    def pose(self,track,t):
        local=[{k:np.array(n.get(k,v),dtype=float) for k,v in [('translation',[0,0,0]),('rotation',[0,0,0,1]),('scale',[1,1,1])]} for n in self.d['nodes']]
        for (node,path),(ts,ys) in track.items():local[node][path]=sample(ts,ys,t,path)
        world={}
        def matrix(i):
            if i in world:return world[i]
            trs=local[i];m=np.eye(4);m[:3,:3]=rotation(trs['rotation'])@np.diag(trs['scale']);m[:3,3]=trs['translation']
            if i in self.parents:m=matrix(self.parents[i])@m
            world[i]=m;return m
        bones=np.array([matrix(i) for i in self.joints])@self.ibms
        xyz=np.einsum('nk,nkij,nj->ni',self.weights,bones[self.vertex_joints],self.points)[:,:3]*SCALE
        self.last_xyz=xyz;self.last_world=world
        boxes=[]
        for name,indices in self.groups.items():
            m=matrix(self.node_by_name[name]);axes=m[:3,:3].copy();axes/=np.linalg.norm(axes,axis=0)
            # Mike's box-shaped head includes the antenna and face. A fighter-local
            # box fits that silhouette without inheriting the diagonal neck axes.
            if name=='head_01':axes=np.eye(3)
            p=xyz[indices]@axes;lo=p.min(axis=0);hi=p.max(axis=0);center=((lo+hi)/2)@axes.T
            boxes.append(np.concatenate((center,(hi-lo)/2,quaternion(axes))).round(7).tolist())
        return boxes
    def bake(self):
        result={}
        for animation in self.d['animations']:
            track=tracks(self.d,self.b,animation);duration=max(ts[-1] for ts,_ in track.values())
            times=np.minimum(np.arange(int(np.ceil(duration*60))+1)/60,duration)
            frames=[self.pose(track,float(t)) for t in times]
            result[animation['name']]={'duration':round(float(duration),7),'frames':frames}
            print(animation['name'],len(frames),flush=True)
        return result
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--stage',type=Path,default=ROOT/'.expo/arena-contact');parser.add_argument('--package',action='store_true');args=parser.parse_args()
    stage=args.stage.resolve();stage.mkdir(parents=True,exist_ok=True)
    if args.package:
        collision=json.loads((stage/'combat-collision-data.json').read_text())
        manifest=json.loads((stage/'combat-animation-manifest.json').read_text())
        inspection=json.loads((stage/'previews/contact-inspection.json').read_text())
        assert inspection['packHashes']==collision['packHashes'] and inspection['collisionDataSha256']==manifest['collisionDataSha256']
        assert all(digest(ASSETS/n)==h for n,h in collision['originals'].items())
        assert all(digest(ASSETS/n) in [h,collision['packHashes'][n]] for n,h in manifest['previousPackHashes'].items())
        manifest['contactPreviewInspection']=inspection
        (stage/'combat-animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        for name in list(collision['packHashes'])+['combat-animation-manifest.json','combat-collision-data.json']:shutil.copyfile(stage/name,ASSETS/name)
        print('Packaged inspected contact packs');return
    manifest=json.loads((ASSETS/'combat-animation-manifest.json').read_text())
    already_fast=any(c['name']=='HitFrontFast' for c in manifest['clips'])
    protected={name:digest(ASSETS/name) for name in manifest['originals']}
    previous={f['file']:digest(ASSETS/f['file']) for f in manifest['files']}
    for entry in manifest['files']:
        d,b=parse(ASSETS/entry['file']);payload=(ASSETS/entry['file']).read_bytes() if already_fast else append_fast(d,b);(stage/entry['file']).write_bytes(payload)
        entry.update(bytes=len(payload),sha256=digest(stage/entry['file']))
    if not already_fast:manifest['clips'].append({'name':'HitFrontFast','durationSeconds':.2,'loopRecommended':False,'derivation':'HitFront retimed to 200ms; final 50ms blend to IdleAggro start','file':None})
    manifest['previousPackHashes']=previous
    d,b=parse(stage/manifest['files'][0]['file']);baker=Baker(d,b)
    fast=d['animations'][-1];fast_digest=hashlib.sha256()
    for ch in fast['channels']:
        sampler=fast['samplers'][ch['sampler']];fast_digest.update((d['nodes'][ch['target']['node']]['name']+':'+ch['target']['path']).encode())
        for key in ['input','output']:fast_digest.update(accessor(d,b,sampler[key]).astype('<f4').tobytes())
    manifest['clips'][-1]['sourceSampleSha256']=fast_digest.hexdigest()
    collision={'schemaVersion':1,'sampleRate':60,'fighterScale':SCALE,'toleranceMeters':.001,'groups':list(baker.groups),'clips':baker.bake(),'packHashes':{f['file']:f['sha256'] for f in manifest['files']},'originals':protected}
    # Colors share identical mesh positions, joint weights, and animation samples.
    rd,rb=parse(stage/manifest['files'][1]['file']);other=Baker(rd,rb)
    assert list(baker.groups)==list(other.groups)
    assert np.array_equal(baker.points,other.points) and np.array_equal(baker.weights,other.weights) and np.array_equal(baker.vertex_joints,other.vertex_joints)
    for a,ra in zip(d['animations'],rd['animations']):
        left=tracks(d,b,a);right=tracks(rd,rb,ra);assert a['name']==ra['name'] and left.keys()==right.keys()
        assert all(np.array_equal(left[k][0],right[k][0]) and np.array_equal(left[k][1],right[k][1]) for k in left)
    collision['bothColorsPoseIdentical']=True
    (stage/'combat-collision-data.json').write_text(json.dumps(collision,separators=(',',':'))+'\n')
    manifest['collisionDataSha256']=digest(stage/'combat-collision-data.json')
    (stage/'combat-animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    assert all(digest(ASSETS/n)==h for n,h in protected.items())
    if args.package:
        inspection=json.loads((stage/'previews/contact-inspection.json').read_text())
        assert inspection['packHashes']==collision['packHashes'] and inspection['collisionDataSha256']==manifest['collisionDataSha256']
        manifest['contactPreviewInspection']=inspection
        (stage/'combat-animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        for name in list(previous)+['combat-animation-manifest.json','combat-collision-data.json']:shutil.copyfile(stage/name,ASSETS/name)
    print(json.dumps({'files':manifest['files'],'groups':list(baker.groups),'originalsPreserved':True,'packaged':args.package},indent=2))
if __name__=='__main__':main()
