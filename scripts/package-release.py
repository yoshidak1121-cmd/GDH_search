"""Build distributable ZIPs from tracked application files; exclude reference data."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'extension/manifest.json').read_text())['version']
if not re.fullmatch(r'\d+\.\d+\.\d+', version):
    raise ValueError('Invalid release version')
setup = root / 'dist/GDH_Search_Setup'
if setup.exists():
    shutil.rmtree(setup)
subprocess.run(['node', 'scripts/build-setup.cjs'], cwd=root, check=True)
out = root / 'dist/release'
out.mkdir(parents=True, exist_ok=True)
packages = []
for folder in ['GDH_Search_Setup', 'GDH_Search_Extension']:
    archive_path = out / f'{folder}_v{version}.zip'
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for source in sorted((root / 'dist' / folder).rglob('*')):
            if source.is_file():
                archive.write(source, folder + '/' + str(source.relative_to(root / 'dist' / folder)))
    packages.append(archive_path)
archive_path = out / f'CNC_Machine_Viewer_v{version}.zip'
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['index.html', 'gdh-embed.js', 'gdh-export.js', 'README.md', 'GDH_INTEGRATION.md', 'CHANGELOG.md']:
        archive.write(root / name, 'CNC_Machine_Viewer/' + name)
    archive.write(root / 'installer/VIEWER_START_HERE.txt', 'CNC_Machine_Viewer/START_HERE.txt')
packages.append(archive_path)
stable_setup = out / 'GDH_Search_Setup.zip'
shutil.copyfile(out / f'GDH_Search_Setup_v{version}.zip', stable_setup)
packages.append(stable_setup)
checksums = []
for package in sorted(packages):
    with zipfile.ZipFile(package) as archive:
        assert archive.testzip() is None
        assert all(not name.endswith('.csv') and '/reference/' not in name for name in archive.namelist())
    checksums.append(hashlib.sha256(package.read_bytes()).hexdigest() + '  ' + package.name)
    print(package.name, package.stat().st_size)
(out / f'SHA256SUMS_v{version}.txt').write_text('\n'.join(checksums) + '\n')

# Published with the packages: no API quota and no unpublished main-branch version.
release_info = {'tag_name': 'v' + version, 'draft': False, 'prerelease': False,
                'assets': [{'name': name, 'browser_download_url':
                    f'https://github.com/yoshidak1121-cmd/GDH_search/releases/download/v{version}/{name}'}
                    for name in [f'GDH_Search_Setup_v{version}.zip', f'SHA256SUMS_v{version}.txt']]}
(out / 'gdh-release.json').write_text(json.dumps(release_info) + '\n')
