"""Trust-boundary checks for the offline skill validator; no upstream code runs."""
import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('skill_validator', ROOT/'scripts/validate_agent_skills.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class SkillValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='starz-skill-check-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT/'.agents', self.root/'.agents')
        shutil.copytree(ROOT/'docs/ux', self.root/'docs/ux')
        shutil.copytree(ROOT/'docs/development', self.root/'docs/development')
        (self.root/'docs/design').mkdir()
        shutil.copy2(ROOT/'docs/design/starz-master-design-system.md', self.root/'docs/design/starz-master-design-system.md')
        shutil.copy2(ROOT/'AGENTS.md', self.root/'AGENTS.md')
        self.assertEqual(validator.validate(self.root), [])

    def test_rejects_modified_upstream_bytes(self):
        path = self.root/'.agents/skills/design-first-ui-prompting/SKILL.md'
        path.write_text(path.read_text()+'\nChanged upstream bytes.\n')
        self.assertTrue(any('Checksum mismatch' in e for e in validator.validate(self.root)))

    def test_rejects_unreviewed_file(self):
        (self.root/'.agents/skills/design-first-ui-prompting/unreviewed.sh').write_text('unreviewed')
        self.assertTrue(any('Unreviewed imported file' in e for e in validator.validate(self.root)))

    def test_rejects_broken_custom_reference(self):
        path = self.root/'.agents/skills/starz-compact-strategy-ui/SKILL.md'
        path.write_text(path.read_text()+'\n[Missing](missing.md)\n')
        self.assertTrue(any('Broken/local reference' in e for e in validator.validate(self.root)))

    def test_rejects_unselected_directory_even_without_skill_metadata(self):
        (self.root/'.agents/skills/unselected').mkdir()
        self.assertTrue(any('Unexpected/missing skills' in e for e in validator.validate(self.root)))
