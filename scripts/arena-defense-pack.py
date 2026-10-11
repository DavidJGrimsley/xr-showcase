"""Append isolated Unreal Arena exports without rebuilding any original payload.

Stage first, inspect Blender previews, then use --package to copy reviewed packs.
Python + numpy are authoring tools only; the app gains no dependency.
"""
import argparse, copy, hashlib, json, struct, shutil
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets/arena'
STAGE=ROOT/'.expo/arena-defense'
def parse(path):
    b=path.read_bytes();assert struct.unpack_from('<III',b)==(0x46546c67,2,len(b))
    n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);size=struct.unpack_from('<I',b,20+n)[0]
    return d,b[28+n:28+n+size]
def values(d,b,index):
    a=d['accessors'][index];v=d['bufferViews'][a['bufferView']]
    assert a['componentType']==5126 and 'byteStride' not in v
    width={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    return np.frombuffer(b,dtype='<f4',count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width).copy()
def build(original,raw,entries):
    old,oldb=parse(original);doc=copy.deepcopy(old);binary=bytearray(oldb)
    names={n.get('name'):i for i,n in enumerate(doc['nodes'])}
    for entry in entries:
        rd,rb=parse(raw/entry['file']);ra=rd['animations'][0]
        for index in rd['skins'][0]['joints']:
            node=rd['nodes'][index];target=doc['nodes'][names[node['name']]]
            for key,default in [('translation',[0,0,0]),('rotation',[0,0,0,1]),('scale',[1,1,1])]:
                assert np.allclose(node.get(key,default),target.get(key,default),atol=1e-6), (node['name'],key)
            assert [rd['nodes'][c]['name'] for c in node.get('children',[])]==[doc['nodes'][c]['name'] for c in target.get('children',[])]
        animation={'name':entry['name'],'channels':[],'samplers':[]}
        for ch in ra['channels']:
            s=ra['samplers'][ch['sampler']];new={}
            for key in ['input','output']:
                arr=values(rd,rb,s[key]);assert np.isfinite(arr).all()
                if key=='input':assert np.all(np.diff(arr[:,0])>0)
                if key=='output' and ch['target']['path']=='translation' and rd['nodes'][ch['target']['node']]['name'] in ['root','SK_ZMike']:
                    assert np.allclose(arr,arr[0],atol=1e-6)
                binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);payload=arr.tobytes();binary.extend(payload)
                view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(payload)})
                a=copy.deepcopy(rd['accessors'][s[key]]);a['bufferView']=view;a.pop('byteOffset',None)
                new[key]=len(doc['accessors']);doc['accessors'].append(a)
            new['interpolation']='LINEAR';animation['samplers'].append(new)
            animation['channels'].append({'sampler':len(animation['samplers'])-1,'target':{'node':names[rd['nodes'][ch['target']['node']]['name']],'path':ch['target']['path']}})
        assert len(animation['channels'])==258
        doc['animations'].append(animation)
    assert len(doc['animations'])==len(old['animations'])+len(entries)
    for key in ['meshes','skins','nodes','materials','textures','images','samplers','scenes']:
        assert doc.get(key)==old.get(key),key
    assert doc['animations'][:23]==old['animations']
    assert binary[:len(oldb)]==oldb
    doc['buffers'][0]['byteLength']=len(binary)
    jb=json.dumps(doc,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4);binary.extend(b'\0'*(-len(binary)%4))
    return struct.pack('<III',0x46546c67,2,28+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary
def sample_hash(d,b,animation):
    digest=hashlib.sha256()
    for ch in animation['channels']:
        sampler=animation['samplers'][ch['sampler']]
        digest.update((d['nodes'][ch['target']['node']]['name']+':'+ch['target']['path']).encode())
        for key in ['input','output']:digest.update(values(d,b,sampler[key]).tobytes())
    return digest.hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--raw',type=Path,required=True);parser.add_argument('--package',action='store_true')
    parser.add_argument('--extra-report',type=Path);parser.add_argument('--stage',type=Path,default=STAGE);args=parser.parse_args()
    stage=args.stage;stage.mkdir(parents=True,exist_ok=True)
    authored=json.loads((args.raw/'authoring.json').read_text());assert authored['status']=='complete' and authored['sourceAssetsByteIdentical']
    if args.extra_report:
        extra=json.loads(args.extra_report.read_text());assert extra['status']=='complete' and extra['sourceAssetsByteIdentical'] and extra['defenseAssetsByteIdentical']
        assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in extra['sourceHashes'].items())
        authored['exports']+=extra['exports']
    assert len({e['name'] for e in authored['exports']})==len(authored['exports'])
    for entry in authored['exports']:
        d,b=parse(args.raw/entry['file']);entry['sourceExportSha256']=hashlib.sha256((args.raw/entry['file']).read_bytes()).hexdigest()
        entry['sourceSampleSha256']=sample_hash(d,b,d['animations'][0])
    manifest={'schemaVersion':1,'clips':authored['exports'],'files':[],'preservesOriginalGeometrySkinningTexturesAndAnimationSamples':True,
              'sources':{'guardArmPose':['Anim_ZMIKE_UppercutL','Anim_ZMIKE_UppercutR'],'guardBase':'Anim_ZMIKE_IdleAggro','movement':['Anim_ZMIKE_Walk','Anim_ZMIKE_WalkLeft','Anim_ZMIKE_WalkRight'],'hop':['Anim_ZMIKE_JumpStart','Anim_ZMIKE_JumpApex','Anim_ZMIKE_JumpEnd']},
              'sourceAssetsByteIdentical':True,'positionAndAirborneLiftOwnedByApp':True,'nativePhoneValidation':'pending','originals':{}}
    if args.extra_report:manifest['sources']['victory']=['Anim_ZMIKE_CalibrationStretches','Anim_ZMIKE_UppercutR','Anim_ZMIKE_IdleAggro']
    for original in ['Fight_Arena.glb','Mike_Player1_Blue_AR.glb','Mike_Player2_RedOrange_AR.glb','fighter-animation-manifest.json']:
        manifest['originals'][original]=hashlib.sha256((ASSETS/original).read_bytes()).hexdigest()
    for original in ['Mike_Player1_Blue_AR.glb','Mike_Player2_RedOrange_AR.glb']:
        name=original.replace('_AR.glb','_Combat_AR.glb');result=build(ASSETS/original,args.raw,authored['exports']);(stage/name).write_bytes(result)
        d,b=parse(stage/name)
        if args.extra_report:
            existing,existing_binary=parse(ASSETS/name)
            for clip in existing['animations']:
                replacement=next(a for a in d['animations'] if a['name']==clip['name'])
                assert sample_hash(existing,existing_binary,clip)==sample_hash(d,b,replacement),clip['name']
        for entry,animation in zip(authored['exports'],d['animations'][23:]):
            assert sample_hash(d,b,animation)==entry['sourceSampleSha256'],entry['name']
        manifest['files'].append({'file':name,'bytes':len(result),'sha256':hashlib.sha256(result).hexdigest()})
    (stage/'combat-animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    if args.package:
        assert (stage/'previews/inspection.json').exists(),'Inspect rendered previews before packaging'
        inspection=json.loads((stage/'previews/inspection.json').read_text())
        assert inspection['packSha256']==manifest['files'][0]['sha256'],'Preview inspection is stale'
        manifest['previewInspection']=inspection
        (stage/'combat-animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        for name in [f['file'] for f in manifest['files']]+['combat-animation-manifest.json']:
            shutil.copyfile(stage/name,ASSETS/name)
    print(json.dumps({'files':manifest['files'],'clipCount':23+len(authored['exports']),'packaged':args.package},indent=2))
if __name__=='__main__':main()
