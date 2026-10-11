"""Development collision overlay, invoked by arena-defense-preview.py --contact.

Displays the exact baked body boxes and striking glove in GLB coordinates.
No overlay ships in the native scene.
"""
import math, hashlib
from mathutils import Matrix, Quaternion
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.fps=60
scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
scene.world=bpy.data.worlds.new('Contact Preview');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.04,.06,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
OUT=args.stage/'previews';OUT.mkdir(parents=True,exist_ok=True)
collision=json.loads((args.stage/'combat-collision-data.json').read_text());scale=collision['fighterScale']
fighters=[]
for color in ['Blue','RedOrange']:
    previous=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(args.stage/f'Mike_Player{1 if color=="Blue" else 2}_{color}_Combat_AR.glb'))
    objects=set(scene.objects)-previous
    root=bpy.data.objects.new(color+' Contact Root',None);scene.collection.objects.link(root)
    for obj in objects:
        if obj.parent is None:obj.parent=root
        if obj.type=='MESH' and not (obj.name.startswith('SKM_MegaMikeZ_part_') or obj.name.startswith('Mike_Body_LED_')):obj.hide_render=True
    fighters.append((root,objects))
for pos,power in [((2,-3,4),700),((-3,-1,2),400)]:
    bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.data.energy=power;bpy.context.object.data.size=4
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.9;scene.camera=camera
materials=[]
for name,color in [('body',(.15,.8,.55,1)),('glove',(1,.4,.05,1))]:
    mat=bpy.data.materials.new(name);mat.diffuse_color=color;mat.use_nodes=True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1
    materials.append(mat)
conversion=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
overlays=[]
def boxes(clip,t,root,striking=None):
    frame=collision['clips'][clip]['frames'][round(t*60)]
    for i,raw in enumerate(frame):
        if striking is not None and collision['groups'][i]!='glove_'+striking.lower():continue
        if striking is None and collision['groups'][i].startswith('glove_'):continue
        center=conversion@Vector(raw[:3])/scale
        q=Quaternion((raw[9],raw[6],raw[7],raw[8]));rotation=conversion@q.to_matrix()@conversion.transposed()
        half=Vector((raw[3],raw[5],raw[4]))/scale
        bpy.ops.mesh.primitive_cube_add(size=2,location=center)
        obj=bpy.context.object;obj.name='Contact '+collision['groups'][i];obj.rotation_mode='QUATERNION';obj.rotation_quaternion=rotation.to_quaternion();obj.scale=half;obj.parent=root
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        wire=obj.modifiers.new('Fitted volume edges','WIREFRAME');wire.thickness=.009;wire.use_replace=True
        obj.data.materials.append(materials[1 if striking else 0]);overlays.append(obj)
def pose(objects,clip):
    for obj in objects:
        if obj.animation_data:
            obj.animation_data.action=None
            for track in obj.animation_data.nla_tracks:track.mute=track.name!=clip
report=[]
cases=[('frontal',.08,0,'Punch',.3),('side-contact',.055,25,'Punch',.3),('off-path',.08,80,'Punch',.3),('uppercut',.055,0,'Uppercut',.48)]
for hand in ['L','R']:
    for label,d,angle,kind,t in cases:
        for obj in overlays:bpy.data.objects.remove(obj,do_unlink=True)
        overlays=[];a,ao=fighters[0];b,bo=fighters[1]
        a.location=(0,0,0);a.rotation_euler=(0,0,0)
        theta=angle if hand=='L' else -angle
        b.location=(math.sin(math.radians(theta))*d/scale,-math.cos(math.radians(theta))*d/scale,0);b.rotation_euler=(0,0,math.radians(theta+180))
        clip=f'Combo_{kind}{hand}';pose(ao,clip);pose(bo,'IdleAggro')
        scene.frame_set(1+round(t*60));boxes(clip,t,a,hand);boxes('IdleAggro',t,b)
        center=Vector((b.location.x/2,b.location.y/2,.7))
        for view,offset in [('front',(0,-4,1)),('overhead',(0,0,5)),('three-quarter',(3,-4,2))]:
            camera.location=center+Vector(offset);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
            file=OUT/f'{label}-{hand}-{view}.png';scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
            report.append({'case':label,'hand':hand,'clip':clip,'seconds':t,'distanceMeters':d,'angleDegrees':theta,'view':view,'file':file.name})
(OUT/'contact-renders.json').write_text(json.dumps(report,indent=2)+'\n')
