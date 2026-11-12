"""Copy project sources and local skills, preserving originals and recording hashes."""
import argparse, hashlib, json, os, re, shutil
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[2]
BRAIN=ROOT/'brain'
IGNORE={'.git','node_modules','.venv','venv','__pycache__','.DS_Store','dist','build','.next','.cache','.data','brain'}
SECRET=re.compile(r'(^\.env($|\.)|auth\.json$|credentials|\.pem$|\.key$)',re.I)
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def copy_project(source,name):
 source=Path(source).expanduser().resolve()
 if not source.is_dir():raise ValueError('Source folder does not exist')
 slug=re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
 if not slug:raise ValueError('Project needs a name')
 target=BRAIN/'projects'/slug
 if source==target or target in source.parents:raise ValueError('Cannot import the vault into itself')
 target.mkdir(parents=True,exist_ok=True)
 records=[]; skipped=[]
 for folder,dirs,files in os.walk(source,followlinks=False):
  dirs[:]=[d for d in dirs if d not in IGNORE and not (Path(folder)/d).is_symlink() and (Path(folder)/d).resolve()!=ROOT]
  for name in files:
   p=Path(folder)/name;rel=p.relative_to(source)
   if name in IGNORE or SECRET.search(name) or p.is_symlink():skipped.append(str(rel));continue
   dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True)
   digest=sha(p)
   if dest.exists() and sha(dest)!=digest:
    dest=dest.with_name(dest.stem+'-import-'+digest[:8]+dest.suffix)
   if not dest.exists():shutil.copy2(p,dest)
   if sha(dest)!=digest:raise RuntimeError('Copy verification failed: '+str(rel))
   records.append({'path':str(dest.relative_to(ROOT)),'original':str(p),'sha256':digest,'bytes':p.stat().st_size})
 manifest={'id':slug,'name':name_arg if (name_arg:=getattr(args,'name',None)) else slug,'source':str(source),'importedAt':datetime.now(timezone.utc).isoformat(),'files':records,'skipped':skipped}
 (target/'import-manifest.json').write_text(json.dumps(manifest,indent=2))
 print(json.dumps({'project':slug,'files':len(records),'verified':True,'skipped':len(skipped)}))
def skills():
 target=ROOT/'.agents/skills';target.mkdir(parents=True,exist_ok=True)
 sources=[]
 for base in [Path.home()/'.agents/skills',Path.home()/'.codex/skills']:
  for entry in base.iterdir():
   if (entry/'SKILL.md').is_file():sources.append(entry/'SKILL.md')
  system=base/'.system'
  if system.is_dir():sources+=list(system.glob('*/SKILL.md'))
 sources+=list((Path.home()/'.codex/plugins/cache').rglob('SKILL.md'))
 sources+=list((ROOT.parent/'.agents/skills').glob('*/SKILL.md'))
 seen=set();entries=[]
 for source in sources:
  digest=sha(source)
  if digest in seen:continue
  seen.add(digest)
  text=source.read_text(errors='replace');name=source.parent.name
  dest=target/name
  if dest.exists() and (dest/'SKILL.md').exists() and sha(dest/'SKILL.md')!=digest:dest=target/(name+'-'+digest[:8])
  if not dest.exists():shutil.copytree(source.parent.resolve(),dest,ignore=shutil.ignore_patterns('.git','node_modules','__pycache__','.venv','.DS_Store'),symlinks=False)
  match=re.search(r'^description:\s*(.+)',text,re.M);desc=(match.group(1).strip().strip('"\'') if match else 'Installed skill')[:350]
  entries.append({'id':dest.name,'name':name,'description':desc,'path':str((dest/'SKILL.md').relative_to(ROOT)),'source':str(source),'sha256':digest,'plugin': '/plugins/' in str(source)})
 BRAIN.mkdir(exist_ok=True)
 (BRAIN/'skills.json').write_text(json.dumps(entries,indent=2))
 (ROOT/'.cursor').mkdir(exist_ok=True)
 link=ROOT/'.cursor/skills'
 if not link.exists():link.symlink_to('../.agents/skills',target_is_directory=True)
 print(json.dumps({'skills':len(entries),'filesVerified':all(sha(ROOT/e['path'])==e['sha256'] for e in entries)}))
parser=argparse.ArgumentParser();parser.add_argument('--source');parser.add_argument('--name');parser.add_argument('--skills',action='store_true');args=parser.parse_args()
if args.skills:skills()
if args.source:copy_project(args.source,args.name or Path(args.source).name)
