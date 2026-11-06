"""Offline metadata, checksum and local-reference validation. Never downloads/executes skills."""
import hashlib,json,re,sys
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.agents/skills'
PIN='5ea1661a0e05d82b054553daaa6baf6d0233c33c'
NAMES={'design-first-ui-prompting','workflow-score-to-target','workflow-progress-screenshots','test-playable-web-games','starz-compact-strategy-ui'}

def validate(root=ROOT):
    base=root/'.agents/skills';errors=[]
    manifest=json.loads((base/'upstream.json').read_text())
    if manifest['commit']!=PIN:errors.append('Upstream pin changed: requires a new explicit security review.')
    if manifest['repository']!='https://github.com/MengTo/Skills' or manifest['license']!='MIT':errors.append('Unexpected source/license.')
    actual={p.name for p in base.iterdir() if p.is_dir()}
    if actual!=NAMES:errors.append(f'Unexpected/missing skills: {actual^NAMES}')
    imported=set()
    for file in manifest['files']:
        path=root/file['installed'];imported.add(path.resolve())
        if path.is_symlink() or not path.resolve().is_relative_to(base.resolve()):errors.append(f'Unsafe import path: {file["installed"]}');continue
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=file['sha256']:errors.append(f'Checksum mismatch: {file["installed"]}')
        if not (file['upstream']=='LICENSE' or any(file['upstream'].startswith('agent-skills/'+prefix+'/') for prefix in ['ui/design-first-ui-prompting','workflow/workflow-score-to-target','workflow/workflow-progress-screenshots','game-development/test-playable-web-games'])):errors.append('Unselected upstream file: '+file['upstream'])
    for name in NAMES:
        folder=base/name;skill=folder/'SKILL.md'
        if not skill.exists():continue
        text=skill.read_text();match=re.match(r'^---\n(.*?)\n---',text,re.S)
        metadata=yaml.safe_load(match[1]) if match else {}
        if metadata.get('name')!=name or not re.fullmatch(r'[a-z0-9-]{1,63}',name):errors.append(f'Invalid name: {name}')
        description=metadata.get('description')
        if not isinstance(description,str) or not 10<=len(description)<=1024:errors.append(f'Invalid description: {name}')
        for file in folder.rglob('*'):
            if file.is_symlink():errors.append(f'Symlink in skill: {file}')
            if file.is_file() and name!='starz-compact-strategy-ui' and file.resolve() not in imported:errors.append(f'Unreviewed imported file: {file.relative_to(root)}')
        ui=folder/'agents/openai.yaml'
        if ui.exists():
            data=yaml.safe_load(ui.read_text())
            if not data.get('interface',{}).get('display_name'):errors.append(f'Missing UI metadata: {name}')
        for ref in re.findall(r'\]\(([^)]+)\)',text):
            if '://' in ref or ref.startswith('#'):continue
            target=(folder/ref.split('#')[0]).resolve()
            if not target.is_relative_to(root) or not target.exists():errors.append(f'Broken/local reference: {name}: {ref}')
    license=(base/'MENGTO-LICENSE').read_text()
    if 'Copyright (c) 2026 Meng To' not in license or 'Permission is hereby granted' not in license:errors.append('MIT attribution missing.')
    return errors

if __name__=='__main__':
    errors=validate()
    if errors:print('\n'.join(errors),file=sys.stderr);sys.exit(1)
    print('PASS: five discoverable skills; four pinned imports; checksums, metadata, license and local references valid.')
