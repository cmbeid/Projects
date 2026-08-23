from model_librarian.core.formats import threemf


def test_bambu_3mf_objects_and_build(bambu_3mf):
    size = bambu_3mf.stat().st_size
    with open(bambu_3mf, "rb") as f:
        facts = threemf.probe(f, size=size, path=str(bambu_3mf))

    assert facts.format == "3mf"
    assert facts.unit == "millimeter"
    assert facts.metadata["Title"] == "Fixture Model"
    assert facts.metadata["Designer"] == "Test Designer"

    names = {o.name for o in facts.objects}
    assert names == {"Body", "Support"}
    assert facts.defined_object_count == 2
    assert facts.build_object_count == 1

    body = next(o for o in facts.objects if o.name == "Body")
    assert body.triangle_count == 12
    assert body.placed is True

    support = next(o for o in facts.objects if o.name == "Support")
    assert support.placed is False

    assert facts.materials == ("PLA Red",)
    assert "Metadata/plate_1.png" in facts.embedded_preview_members


def test_bambu_3mf_settings_normalized_across_sources(bambu_3mf):
    size = bambu_3mf.stat().st_size
    with open(bambu_3mf, "rb") as f:
        facts = threemf.probe(f, size=size, path=str(bambu_3mf))

    by_source = {}
    for block in facts.settings:
        by_source.setdefault(block.source, {})[block.key] = block.value

    assert by_source["project_settings"]["layer_height"] == "0.2"
    assert by_source["project_settings"]["printer_model"] == "X1C"
    assert by_source["model_settings"]["object[1].name"] == "Body"
    assert by_source["model_settings"]["plate[1].plater_name"] == "Plate 1"
    assert by_source["slice_info"]["plate[1].prediction"] == "3600"
    assert by_source["slice_info"]["plate[1].filament[1].used_g"] == "12.5"


def test_prusa_3mf_ini_style_settings(prusa_3mf):
    size = prusa_3mf.stat().st_size
    with open(prusa_3mf, "rb") as f:
        facts = threemf.probe(f, size=size, path=str(prusa_3mf))

    assert facts.defined_object_count == 1
    assert facts.build_object_count == 1

    by_key = {block.key: block.value for block in facts.settings if block.source == "Slic3r_PE"}
    assert by_key["layer_height"] == "0.2"
    assert by_key["fill_density"] == "15%"
    assert by_key["filament_type"] == "PLA"


def test_extract_embedded_preview_prefers_plate_png(bambu_3mf):
    data = threemf.extract_embedded_preview(str(bambu_3mf))
    assert data == b"\x89PNG\r\n\x1a\nfakepngdata"


def test_extract_embedded_preview_returns_none_when_absent(prusa_3mf):
    assert threemf.extract_embedded_preview(str(prusa_3mf)) is None
