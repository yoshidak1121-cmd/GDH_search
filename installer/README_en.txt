GDH Search automatic updates (Windows / Edge・Chrome)

One-time setup
1. Extract the latest Setup ZIP and run Install.bat.
2. Keep Developer mode enabled, reload this extension and approve new permissions if requested.
3. Press F5 on GDH. Test the helper using Updates and setup in the popup.

Future updates
The tool checks GitHub at startup. Choose Yes when a newer version is offered.
Download, SHA-256 verification, full-folder replacement, extension reload and the original GDH page reload are automatic.
A GDH tab that navigated to another document during installation will not be reloaded.

Windows update helper
A small, non-resident program that accepts approved update commands from this extension only.
Files are placed in %LOCALAPPDATA%\GDH_Search. Chrome/Edge NativeMessagingHosts entries are registered for the current Windows user.
No desktop files, management-policy changes, browser-profile edits or permanent execution-policy changes are made.
Only releases from yoshidak1121-cmd/GDH_search are used. No GDH records or credentials are sent to GitHub or the helper.
Obsolete application files are removed by folder replacement; the previous version stays in Backup-*.
If company policy does not permit the helper, use manual setup instead.

Manual setup
https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/GDH_Search_Setup.zip
For first registration, Load unpacked from %LOCALAPPDATA%\GDH_Search\Extension.
Use this location if an earlier copy was registered elsewhere.
Management pages: edge://extensions/ or chrome://extensions/.
Updates and setup includes browser-specific steps and official browser help.
This is beta software, not a standard GDH feature. Normal CSV retrieval is maintained.
