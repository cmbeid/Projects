from model_librarian.core.formats import obj


def test_multi_object_obj_names_and_counts(multi_object_obj):
    size = multi_object_obj.stat().st_size
    with open(multi_object_obj, "rb") as f:
        facts = obj.probe(f, size=size, path=str(multi_object_obj))

    assert facts.format == "obj"
    assert [o.name for o in facts.objects] == ["Body", "Base"]
    assert facts.defined_object_count == 2
    assert facts.triangle_count == 3
    assert "body" in facts.materials
    assert all(ref.resolved for ref in facts.external_refs)


def test_obj_missing_mtl_is_flagged(obj_missing_mtl):
    size = obj_missing_mtl.stat().st_size
    with open(obj_missing_mtl, "rb") as f:
        facts = obj.probe(f, size=size, path=str(obj_missing_mtl))

    mtllib_refs = [r for r in facts.external_refs if r.kind == "mtllib"]
    assert len(mtllib_refs) == 1
    assert mtllib_refs[0].resolved is False
    assert any("could not be found" in w for w in facts.warnings)
