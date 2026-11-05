'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
execFileSync(process.execPath,[path.join(__dirname,'build-extension.cjs')],{stdio:'inherit'});
const dest=path.join(root,'dist','GDH_Search_Setup');
// Refuse stale output rather than accidentally distributing additional files.
if(fs.existsSync(dest))throw Error('Setup output already exists; use a fresh build directory.');
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(path.join(root,'dist','GDH_Search_Extension'),path.join(dest,'GDH_Search_Extension'),{recursive:true});
for(const name of ['Install.bat','Setup.ps1','START_HERE.txt','README_ja.txt','README_en.txt'])fs.copyFileSync(path.join(root,'installer',name),path.join(dest,name));
console.log('Setup package: '+dest);

