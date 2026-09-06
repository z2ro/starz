from __future__ import annotations

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "frontend" / "assets" / "models"


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_material(name: str, color: tuple[float, float, float, float], metallic: float = 0.0,
                  roughness: float = 0.5, emission: tuple[float, float, float, float] | None = None,
                  emission_strength: float = 0.0) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission and "Emission" in principled.inputs:
        principled.inputs["Emission"].default_value = emission
    if "Emission Strength" in principled.inputs:
        principled.inputs["Emission Strength"].default_value = emission_strength
    return material


def assign(obj: bpy.types.Object, material: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(material)
    return obj


def bevel(obj: bpy.types.Object, amount: float = 0.02, segments: int = 2) -> bpy.types.Object:
    modifier = obj.modifiers.new("edge bevel", "BEVEL")
    modifier.width = amount
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def cube(name: str, location: tuple[float, float, float], scale: tuple[float, float, float],
         material: bpy.types.Material, bevel_size: float = 0.02, rotation: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, material)
    if bevel_size:
        bevel(obj, min(bevel_size, min(scale) * 0.35), 2)
    return obj


def cylinder(name: str, location: tuple[float, float, float], radius: float, depth: float,
             material: bpy.types.Material, vertices: int = 16, rotation: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    bevel(obj, min(radius * 0.18, depth * 0.12), 2)
    return obj


def cone(name: str, location: tuple[float, float, float], radius1: float, radius2: float, depth: float,
         material: bpy.types.Material, vertices: int = 16, rotation: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    bevel(obj, min(radius1 * 0.12, depth * 0.08), 2)
    return obj


def sphere(name: str, location: tuple[float, float, float], scale: tuple[float, float, float],
           material: bpy.types.Material, segments: int = 16, rings: int = 8) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def torus(name: str, location: tuple[float, float, float], major_radius: float, minor_radius: float,
          material: bpy.types.Material, rotation: tuple[float, float, float] = (0, 0, 0), major_segments: int = 32) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius,
                                     major_segments=major_segments, minor_segments=8,
                                     location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def export_glb(path: str | Path) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            for polygon in obj.data.polygons:
                polygon.use_smooth = polygon.use_smooth
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    return target
