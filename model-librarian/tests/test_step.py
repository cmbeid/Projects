from model_librarian.core.formats import step


def test_step_header_and_entity_tallies(step_two_part_assembly):
    size = step_two_part_assembly.stat().st_size
    with open(step_two_part_assembly, "rb") as f:
        facts = step.probe(f, size=size, path=str(step_two_part_assembly))

    assert facts.format == "step"
    assert facts.metadata["author"] == "Jane Engineer"
    assert facts.metadata["organization"] == "Acme Corp"
    assert facts.originating_system == "SolidWorks 2023"
    assert facts.file_schema == "AP203"

    names = [o.name for o in facts.objects]
    assert names == ["Bracket", "Fastener"]
    assert facts.defined_object_count == 2

    assert facts.metadata["assembly_instance_count"] == "1"
    assert facts.metadata["solid_body_count"] == "1"
    assert facts.metadata["face_count"] == "2"
