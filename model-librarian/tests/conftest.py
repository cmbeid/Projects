"""Synthesize fixture files at test time — nothing binary is committed.

Every fixture is built from scratch with `struct`/`zipfile`/plain text so
each parser test can assert exactly which bytes produced which fact.
"""

from __future__ import annotations

import json
import os
import struct
import zipfile

import pytest

# Headless CI/dev containers have no display; PySide6 needs to know to use
# its offscreen platform plugin before anything constructs a QApplication.
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

_CUBE_VERTICES = [
    (0, 0, 0),
    (1, 0, 0),
    (1, 1, 0),
    (0, 1, 0),
    (0, 0, 1),
    (1, 0, 1),
    (1, 1, 1),
    (0, 1, 1),
]
_CUBE_TRIANGLES = [
    (0, 1, 2),
    (0, 2, 3),
    (4, 6, 5),
    (4, 7, 6),
    (0, 4, 5),
    (0, 5, 1),
    (1, 5, 6),
    (1, 6, 2),
    (2, 6, 7),
    (2, 7, 3),
    (3, 7, 4),
    (3, 4, 0),
]


@pytest.fixture
def binary_stl(tmp_path):
    path = tmp_path / "cube_binary.stl"
    with open(path, "wb") as f:
        header = b"Exported from Blender-4.0" + b"\x00" * (80 - len(b"Exported from Blender-4.0"))
        f.write(header)
        f.write(struct.pack("<I", len(_CUBE_TRIANGLES)))
        for tri in _CUBE_TRIANGLES:
            f.write(struct.pack("<3f", 0.0, 0.0, 1.0))  # normal (unused by parser)
            for idx in tri:
                f.write(struct.pack("<3f", *_CUBE_VERTICES[idx]))
            f.write(struct.pack("<H", 0))  # attribute byte count
    return path


@pytest.fixture
def ascii_stl(tmp_path):
    path = tmp_path / "cube_ascii.stl"
    lines = ["solid cube"]
    for tri in _CUBE_TRIANGLES:
        lines.append("  facet normal 0 0 1")
        lines.append("    outer loop")
        for idx in tri:
            v = _CUBE_VERTICES[idx]
            lines.append(f"      vertex {v[0]} {v[1]} {v[2]}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append("endsolid cube")
    path.write_text("\n".join(lines) + "\n")
    return path


@pytest.fixture
def multi_object_obj(tmp_path):
    obj_path = tmp_path / "scene.obj"
    mtl_path = tmp_path / "scene.mtl"
    texture_path = tmp_path / "diffuse.png"
    texture_path.write_bytes(b"\x89PNG\r\n\x1a\n")

    mtl_path.write_text("newmtl body\nmap_Kd diffuse.png\n")

    lines = [
        "mtllib scene.mtl",
        "o Body",
        "v 0 0 0",
        "v 1 0 0",
        "v 0 1 0",
        "usemtl body",
        "f 1 2 3",
        "o Base",
        "v 0 0 0",
        "v 1 0 0",
        "v 1 1 0",
        "v 0 1 0",
        "usemtl body",
        "f 4 5 6",
        "f 4 6 7",
    ]
    obj_path.write_text("\n".join(lines) + "\n")
    return obj_path


@pytest.fixture
def obj_missing_mtl(tmp_path):
    path = tmp_path / "broken.obj"
    path.write_text("mtllib missing.mtl\no Thing\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
    return path


def _write_3mf_model_xml(objects_xml: str, build_xml: str, unit: str = "millimeter") -> bytes:
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<model unit="{unit}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Fixture Model</metadata>
  <metadata name="Designer">Test Designer</metadata>
  <metadata name="Application">BambuStudio-1.9.0</metadata>
  <resources>
    <basematerials id="1">
      <base name="PLA Red" displaycolor="#FF0000FF"/>
    </basematerials>
    {objects_xml}
  </resources>
  <build>
    {build_xml}
  </build>
</model>"""
    return xml.encode("utf-8")


def _mesh_xml(vertices, triangles) -> str:
    v_xml = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in vertices)
    t_xml = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in triangles)
    return f"<mesh><vertices>{v_xml}</vertices><triangles>{t_xml}</triangles></mesh>"


@pytest.fixture
def bambu_3mf(tmp_path):
    """A synthetic Bambu-Studio-shaped 3MF: two objects, project/model/slice
    configs, a plate PNG."""
    path = tmp_path / "bambu_project.3mf"
    body_mesh = _mesh_xml(_CUBE_VERTICES, _CUBE_TRIANGLES)
    # Only the first two triangles reference vertices 0-3, so this stays a
    # geometrically valid (if degenerate) mesh that trimesh can load.
    support_mesh = _mesh_xml(_CUBE_VERTICES[:4], _CUBE_TRIANGLES[:2])
    objects_xml = (
        f'<object id="1" type="model" name="Body">{body_mesh}</object>'
        f'<object id="2" type="model" name="Support">{support_mesh}</object>'
    )
    # Support (id=2) is defined but never placed on the build plate — the
    # "defined vs. actually on the plate" distinction the object tree exists to show.
    build_xml = '<item objectid="1" printable="1"/>'
    model_bytes = _write_3mf_model_xml(objects_xml, build_xml)

    project_settings = json.dumps(
        {"layer_height": "0.2", "wall_loops": "3", "printer_model": "X1C"}
    ).encode("utf-8")
    model_settings = (
        b'<?xml version="1.0"?><config>'
        b'<object id="1"><metadata key="name" value="Body"/></object>'
        b'<plate><metadata key="plater_id" value="1"/>'
        b'<metadata key="plater_name" value="Plate 1"/></plate>'
        b"</config>"
    )
    slice_info = (
        b'<?xml version="1.0"?><config><plate>'
        b'<metadata key="index" value="1"/>'
        b'<metadata key="prediction" value="3600"/>'
        b'<filament id="1" type="PLA" color="#FF0000" used_g="12.5" used_m="4.1"/>'
        b"</plate></config>"
    )

    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("3D/3dmodel.model", model_bytes)
        zf.writestr("Metadata/project_settings.config", project_settings)
        zf.writestr("Metadata/model_settings.config", model_settings)
        zf.writestr("Metadata/slice_info.config", slice_info)
        zf.writestr("Metadata/plate_1.png", b"\x89PNG\r\n\x1a\nfakepngdata")
    return path


@pytest.fixture
def prusa_3mf(tmp_path):
    """A synthetic PrusaSlicer-shaped 3MF: one object, Slic3r_PE ini-style config."""
    path = tmp_path / "prusa_project.3mf"
    widget_mesh = _mesh_xml(_CUBE_VERTICES, _CUBE_TRIANGLES)
    objects_xml = f'<object id="1" type="model" name="Widget">{widget_mesh}</object>'
    build_xml = '<item objectid="1" printable="1"/>'
    model_bytes = _write_3mf_model_xml(objects_xml, build_xml)

    slic3r_pe_config = (
        b"; generated by PrusaSlicer\n"
        b"; layer_height = 0.2\n"
        b"; fill_density = 15%\n"
        b"; filament_type = PLA\n"
    )

    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("3D/3dmodel.model", model_bytes)
        zf.writestr("Metadata/Slic3r_PE.config", slic3r_pe_config)
    return path


@pytest.fixture
def step_two_part_assembly(tmp_path):
    path = tmp_path / "assembly.stp"
    content = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('assembly.stp','2024-01-15T10:00:00',('Jane Engineer'),('Acme Corp'),
  '','SolidWorks 2023','');
FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));
ENDSEC;
DATA;
#10=PRODUCT('Bracket','Bracket','',(#100));
#11=PRODUCT('Fastener','Fastener','',(#100));
#20=NEXT_ASSEMBLY_USAGE_OCCURRENCE('rel1','','',#10,#11,$);
#30=MANIFOLD_SOLID_BREP('body1',#31);
#31=ADVANCED_FACE('face1',(#32),#33,.T.);
#34=ADVANCED_FACE('face2',(#35),#36,.T.);
ENDSEC;
END-ISO-10303-21;
"""
    path.write_text(content)
    return path
