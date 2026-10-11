"""Blender front and three-quarter renders for each new combat silhouette."""
import bpy, sys, json, argparse
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--stage',type=Path,default=ROOT/'.expo/arena-defense');parser.add_argument('--victory',action='store_true');parser.add_argument('--motion',action='store_true');parser.add_argument('--contact',action='store_true');parser.add_argument('--reaction',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
args.stage=args.stage.resolve()
if args.contact:
    exec(compile((ROOT/'scripts/arena-contact-preview.py').read_text(),str(ROOT/'scripts/arena-contact-preview.py'),'exec'))
    raise SystemExit(0)
OUT=args.stage/'previews';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=60 if args.reaction else 30
bpy.ops.import_scene.gltf(filepath=str(args.stage/'Mike_Player1_Blue_Combat_AR.glb'))
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
scene.render.fps=60 if args.reaction else 30;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
scene.world=bpy.data.worlds.new('Arena Preview');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.045,.06,.085,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for obj in scene.objects:
    if obj.type=='MESH' and not (obj.name.startswith('SKM_MegaMikeZ_part_') or obj.name.startswith('Mike_Body_LED_')):obj.hide_render=True
for pos,power in [((2,-3,4),600),((-3,-1,2),350)]:
    bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power;light.data.size=4
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.1 if args.victory else 1.9;scene.camera=camera
report=[]
samples=[('Victory',2.3)]+[('VictoryUppercut',t) for t in [0,.233333,.5,.7,1.1,1.5,2]] if args.victory else [('BlockHold',.5),('BlockAdvance',.4),('BlockStrafeLeft',.4),('BlockStrafeRight',.4),('JumpBack',.067),('JumpBack',.2),('JumpBack',.367)]
if args.reaction:samples=[('HitFrontFast',t) for t in [.05,.1,.15,.2]]
for clip,t in samples:
    for obj in scene.objects:
        if obj.animation_data:
            obj.animation_data.action=None
            for track in obj.animation_data.nla_tracks:track.mute=track.name!=clip
    scene.frame_set(1+round(t*scene.render.fps))
    for label,pos in [('front',(0,-4,1.15)),('three-quarter',(2.2,-4,1.4))]:
        center=Vector((0,0,.8));camera.location=Vector(pos);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        file=OUT/(clip+'-'+str(t)+'-'+label+'.png');scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
        report.append({'clip':clip,'seconds':t,'view':label,'file':file.name})
(OUT/'renders.json').write_text(json.dumps(report,indent=2))
if args.motion:
    frames=OUT/'motion';frames.mkdir(exist_ok=True)
    scene.render.resolution_x=360;scene.render.resolution_y=432
    center=Vector((0,0,.8));camera.location=Vector((2.2,-4,1.4));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    index=0
    for clip,seconds in [('Victory',2.3),('Victory',2.3),('VictoryUppercut',2.0)]:
        for obj in scene.objects:
            if obj.animation_data:
                obj.animation_data.action=None
                for track in obj.animation_data.nla_tracks:track.mute=track.name!=clip
        for frame in range(round(seconds*15)):
            scene.frame_set(1+frame*2);scene.render.filepath=str(frames/f'{index:03}.png');bpy.ops.render.render(write_still=True);index+=1
    scene.frame_set(61);scene.render.filepath=str(frames/f'{index:03}.png');bpy.ops.render.render(write_still=True)
