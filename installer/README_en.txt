GDH Machine Search - English guide
For Windows / Microsoft Edge and Google Chrome

1. Before you start
This is a personally developed extension, not a standard GDH feature.
It is a beta version; no guarantee of operation or support is provided.
For independent development of a similar extension, consult Yoshida, NC Strategy.

The extension supports the machine information search page under this URL:
https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/
It does not support separate regional GDH URLs. You need access to this GDH environment.
If company settings prevent installation, check with your administrator.

2. First-time setup
(1) Right-click the ZIP and select Extract All. Do not run files from inside the ZIP.
(2) Double-click Install.bat in the extracted folder. Administrator rights are not required.
(3) Review the planned changes and press Enter. To cancel, press Ctrl+C.
    When prompted, type 1 for Edge or 2 for Chrome, then press Enter.
    Choose the browser you normally use for GDH.
(4) The extensions management page opens. If it does not, enter the following in the address bar:
    Edge:   edge://extensions/
    Chrome: chrome://extensions/
(5) Turn on Developer mode.
(6) Click Load unpacked.
(7) In the folder picker, press Ctrl+L, Ctrl+V, then Enter to open the copied location.
    If you lost the copied path, enter:
    %LOCALAPPDATA%\GDH_Search\Extension
    Select the Extension folder containing manifest.json, rather than the file itself.
    Files may be hidden in the folder picker; select the folder if the location is correct.
(8) Confirm that the extension named "GDH 機械情報 拡張検索" appears and is enabled.
    The registered extension name is Japanese, even on English Windows.
(9) In the same browser profile, reload the GDH machine information search page.
    Click the extension search button at the bottom right. It may appear as "拡張検索".
(10) Return to the console and press Enter to review the changes made. Press Enter again to exit.

Install.bat prepares files, copies the destination path, and requests the browser management page to open.
It does not register or enable the extension, or inspect existing browser registration.
Keep the installed Extension folder in place; do not move or delete it.

3. Updating
(1) Extract the new ZIP and run Install.bat.
(2) Choose the same browser. Previous files are moved to a Backup-* folder.
(3) On the extensions management page, click Reload (the circular arrow) for this extension.
    If it is already registered at the same location, do not add it again with Load unpacked.
(4) Confirm that the displayed version matches the distributed version, then reload the GDH page.
    Retrieve your data again: reloading clears loaded CSV data and search filters.
If you previously loaded it from another folder, register the new location, check operation,
then remove the old registration.
Publishing on GitHub or downloading a ZIP does not update an installed extension automatically.

4. Using the search
- For everyday use, open extension search in GDH; you do not need to run Install.bat again.
- Select English using the Japanese / English selector at the top right of the search screen.
- Click Get data from GDH and confirm CSV export. The CSV is downloaded and loaded into the search screen.
- Retrieval usually takes 30 seconds to 1 minute. If nothing changes for more than 5 minutes,
  export the CSV manually in GDH and use Load local data.
- Enter or select filters, then click Search. Select a row to see all original CSV fields.
- Advanced options include Reference search. These fields contain many blanks and are reference data only.
- Dashboard > Data maintenance shows blank rates by field. The denominator is the number of records matching applied filters.
- The interface can switch between Japanese and English. Original CSV values are not translated.

5. Check after setup
[ ] The extension is enabled in the browser and profile you use for GDH.
[ ] You can open and close extension search in GDH.
[ ] Retrieval or local CSV loading completes and the record count is as expected.
[ ] Searching for a known serial shows the expected row, with details matching the source CSV.
[ ] You can clear filters and switch between Japanese and English.
If you only used a local CSV, GDH retrieval has not been verified.

6. Troubleshooting and manual installation
- On an error, read the console message and summary of changes made.
- If the folder cannot be found, check that file preparation completed.
- If GDH has no search button, check the supported URL, browser/profile, and extension enabled state, then reload.
- If company restrictions block setup, check with your administrator. Do not change restrictions to bypass them.
- If manual loading is permitted, keep GDH_Search_Extension in a permanent folder and load that folder
  from the extensions management page. Do not select the ZIP or manifest.json file itself.
- To uninstall, remove the extension in the browser first, then delete its folder and unwanted backups.

7. Data and settings
CSV data is processed in the browser. This tool does not send it to GitHub or external services.
Closing the search screen or reloading GDH discards loaded data. Downloaded CSV files remain on your PC.
When sharing an issue, include the version, browser name, and displayed message. Do not attach actual CSV or customer data.
The execution policy option in Install.bat applies only to the PowerShell process it starts.
Setup does not change management policies, the registry, browser profiles, or permanent execution policy.

Setup uses Japanese for Japanese Windows UI and English for all other Windows UI languages.
To select English manually, open PowerShell in the extracted folder and run:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup.ps1 -Language en
For Japanese, replace the final option with -Language ja.
