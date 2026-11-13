GDH Search setup and updates (Windows)

This update
1. Extract All and run Install.bat.
2. Click Reload on this extension in the browser that opens.
3. Press F5 on the GDH page.

Update from GitHub
Use Update from GitHub in the popup, or download the latest Setup ZIP:
https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/GDH_Search_Setup.zip
Extract, run Install.bat, reload the extension, then press F5 on GDH.
No desktop files are created. The previous unmodified GDH Update shortcut owned by this tool is removed.
Previous extension files remain in Backup-*. Applying changes in the browser is manual.

First installation only
Developer mode > Load unpacked > select the copied folder path.
Folder: %LOCALAPPDATA%\GDH_Search\Extension
Browser registration/enabling is manual. No administrator rights are needed.
If previously registered from a different folder, register this folder once.

Browser selection
Saved browser > single running browser > default browser > only installed browser.
A choice is requested only if detection is ambiguous: 1 Edge, 2 Chrome.
To switch: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup.ps1 -Browser Chrome
Use -Browser Edge for Edge. The choice is remembered.
Use your usual GDH browser profile.

Management pages: edge://extensions/ or chrome://extensions/
This tool is beta software and is not a standard GDH feature.
Normal production retrieval continues to use CSV.
