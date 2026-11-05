# CNC機械情報ビューア / GDH拡張検索 v1.11.1

GDHのCSVをブラウザ内で検索するツールです。Chrome / Edge向け拡張機能、単独HTML、架空データ入りの操作デモを提供します。

## 検索画面

基本検索項目は7つです。左列に機械シリアル、NCシリアル、機械メーカー、エンドユーザー、右列に契約タイプ、輸入国、輸出国を配置します。各項目は左に項目名、右に入力欄を並べ、「この条件で検索」は入力欄全体の下に配置しています。狭い画面では1列になります。一致方法・説明・空欄指定は「詳細条件」を開いたときに表示します。

| 項目 | 操作 |
|---|---|
| 機械シリアル | 文字入力。部分一致・前方一致・完全一致 |
| NCシリアル | 文字入力。部分一致・前方一致・完全一致 |
| 契約タイプ | CSV内の値をチェックボックスで複数選択 |
| 機械メーカー | 入力してCSV内の候補から複数選択 |
| エンドユーザー | 自由入力の表記揺れ検索、または元表記の候補選択 |
| 輸出国 | 入力してCSV内の候補から複数選択 |
| 輸入国 | 入力してCSV内の候補から複数選択 |

同じ項目内の複数条件はOR、項目同士はANDです。未指定の項目は絞りません。「空欄」だけを選べば空欄のみを検索し、ほかの値と併用すれば値または空欄になります。

候補を選び、または検索語を入力して「この条件で検索」を押します。複数の入力語を使う場合は、入力時に表示される「＋追加」を使います。候補はフォーカス・入力時だけ表示し、矢印キーで候補を選択してEnterで確定できます。エンドユーザー・シリアルでは、候補未選択のEnterは入力語で検索し、最初の候補を勝手に選択しません。

結果一覧も7項目に揃えています。行を選ぶと元CSVの全項目を表示し、詳細の「閉じる」で一覧の全幅表示に戻ります。

## 日本語／英語の切替

画面右上の「言語 / Language」で日本語とEnglishを切り替えられます。項目名、案内、詳細、件数・日時、重複表示などを切り替えます。読み込んだデータ、入力条件、選択値、現在のページと詳細表示を保持します。CSV内の会社名・国名・契約タイプ・シリアル等の値は翻訳・書き換えしません。言語設定は画面URLのlangに反映し、CSVを保存する処理は追加しません。

取得ボタンは「GDHからデータ取得」／「Get data from GDH」、ファイル選択ボタンは「ローカルからデータ取得」／「Load local data」と表示します。既存の取得・ダウンロード・自動反映機能は残しています。

拡張機能のポップアップにも言語切替があり、検索画面と外枠の表示言語へ反映します。GDH本体の既存画面やOSのファイル選択ダイアログは、この切替の対象外です。

## CSVからの毎回の更新

選択肢・候補はCSVの実値から作成します。メーカー名・国・契約タイプ等の選択肢をコードに固定していません。CSVの再取得／再読込に成功すると、候補・件数・条件を初期化し直します。読込に失敗した場合は既存データを保持します。

列位置ではなく列名で対応付けるので、CSVの列順が変わっても対応します。実CSVの列名「工作機械シリアル番号」を画面では「機械シリアル」と表示します。「機械メーカ」「エンドユーザ」「機械シリアル番号」「NCシリアル」等の既知の列名別表記も認識します。対応列がない場合は、その項目に「このCSVに対応する列がありません」と表示します。

33列の実CSV（192,836行、約60MB）で読込と検索を確認しています。候補は種類数とCSV全体の件数を表示し、入力候補は一度に最大30件です。他の条件に連動した候補件数ではありません。

## カンマ区切りの複数値と重複表示

このCSVの仕様に従い、1セル内のカンマ（`,` または `，`）で連結された値は、個別の値として候補・検索対象にします。CSV自体の引用符を解析した後にセル内部を分けます。たとえばメーカーが `Alpha, Beta` の行は、候補 `Alpha` と `Beta` のどちらからも検索できます。シリアルや名称の完全一致も分割後の各値に対して行います。

同じ項目内の値はOR、項目間はANDです。セル内の値の位置から項目間の対応関係を推測せず、新しい機械レコードを組み立てたり、行を統合・増殖させたりしません。件数は元CSVの行数です。候補の件数も、その値を含む行数で数え、同一セル内で同じ値が繰り返されても1行として数えます。

複数の値が入るセルがある行、または同一NCシリアルがCSV内の別行にも存在する行に、色付きの「重複あり」を表示します。同一NCシリアルの判定は前後空白を除いた原表記で行い、ハイフン等を変えて別番号を同一扱いにはしません。

結果一覧は各値を区切って表示します。長いリストは先頭3値と残り件数を表示し、行の詳細ですべて確認できます。詳細では分割した各値と「元のCSV値」の両方を表示します。元データは変更しません。

「詳細条件」の「重複ありのみ表示」をチェックして検索すると、重複対象の行だけに絞り込みます。7項目の条件ともANDで組み合わせます。チェックが有効な間は詳細条件を閉じても表示を残し、条件クリア・CSV再読込で解除します。

## エンドユーザーの表記揺れ

自由入力の「表記揺れを吸収」ではNFKC、大小文字、空白・区切り記号、かな／カナを揃え、㈱・(株)・株式会社、および㈲・(有)・有限会社を同じ表記に揃えて部分一致で検索します。法人格・工場・支店名を勝手に削除しません。

元のCSV値は変更せず、同一企業として名寄せもしません。候補を選ぶ場合は、選択した元表記との完全一致です。自由入力の「完全一致」も元の表記を比較します。少し違う名称は「類似候補」として表示しますが、自動的には検索結果へ含めません。

シリアル番号は名称の表記揺れ処理と分離し、全半角・大小文字を揃えてもハイフン等は保持します。編集距離で別の番号を一致扱いにはしません。

## 登録機械情報・確認対象

同じ読込CSVを使う分析タブです。サービス拠点・輸入国・重要5項目の値なし・NCシリアル再登場で対象を選び、4カード、分類分布、20件ずつの一覧から元行の全列詳細を確認できます。検索タブとは条件とページを分離し、CSV読込成功時だけ両方を初期化します。元データ更新日時は「不明」です。

集計では前後空白を除いたセル全体を厳密比較します。カンマを分割せず、NC再登場はCSV全体の非空値で判定します。既存検索の複数値検索・「重複あり」と意味が異なります。列不足は該当集計だけ算定不可、失敗時は前回成功データを保持します。登録行数は稼働設備台数ではありません。

棒・カードは適用済み条件から該当条件を置換します。値なし対象の置換で対象範囲が広がる場合は、選択前の棒件数と選択後件数が異なります（依頼者確認済み）。検証・性能条件と未確認事項は [DASHBOARD_VALIDATION.md](DASHBOARD_VALIDATION.md) に記録しています。関連試験は `node tests/dashboard.cjs`、性能試験も行う場合は `DASHBOARD_PERF=1` を指定します。開発用Playwrightのみを使用し、アプリの依存追加はありません。

## 導入

### 導入支援BATを使う（Windows）

[導入支援パッケージ](https://github.com/yoshidak1121-cmd/GDH_search/releases/tag/v1.11.1)の `GDH_Search_Setup_v1.11.1.zip` を「すべて展開」し、**Install.bat** をダブルクリックします。Edge／Chromeを選ぶと、拡張機能を `%LOCALAPPDATA%\GDH_Search\Extension` に配置し、読み込み先のパスをコピーして拡張機能管理画面を開きます。

導入案内はWindowsの表示言語から自動選択します。日本語のWindowsでは日本語、それ以外では英語になります。`START_HERE.txt` が入口です。日本語は `README_ja.txt`、英語は `README_en.txt` を参照してください。検索画面の表示言語は画面内の言語選択で切り替えられます。

**English:** Extract the setup ZIP and double-click **Install.bat**. Setup uses Japanese for Japanese Windows UI and English otherwise. Choose Edge or Chrome, then manually enable **Developer mode**, click **Load unpacked**, and paste the copied folder path. Updates back up the previous files; reload the extension and GDH page afterwards. Administrator rights are not required. Company-managed restrictions still apply. Open **START_HERE.txt**, then **README_en.txt** for English instructions or **README_ja.txt** for Japanese.

**開発者モードをオン → 展開して読み込み → パスを貼り付けてフォルダーを選択**の操作は手動です。管理者権限は不要で、管理ポリシーやPCの恒久的な実行ポリシーは変更しません。導入用PowerShellのプロセスだけ実行を許可します。会社の管理ポリシーが優先されます。スクリプト実行が制限されているPCでは、以下の手動導入を使ってください。

更新時も新しいパッケージのInstall.batを実行します。旧ファイルを同じ保存先のBackupフォルダーへ退避して配置します。最後に拡張機能とGDH画面を再読み込みしてください。以前別の場所から登録した場合は、古い登録を削除して新しい配置先を登録します。詳しくは同梱のREADME_ja.txtを参照してください。

### 実行前・実行後の表示 / Before and after setup

【実行前と実行後の表示 / Before and after running setup】
最初に、これから作成する保存先、ファイル配置、一時フォルダー、更新前のバックアップ、クリップボード変更、管理画面を開くことを表示します。内容を確認し、Enterキーで配置を開始します。中止する場合はCtrl+Cを押します。
ブラウザーで設定・動作確認を終え、この黒い画面に戻ってEnterキーを押すと、この実行で実際に配置した場所、作成したフォルダー、バックアップ先、クリップボードの変更、ブラウザーを開く要求の結果を表示します。失敗時も分かる範囲の変更を表示します。
このBATはファイルを配置するだけで、ブラウザーへの拡張機能のインストール・登録・有効化は行いません。既存の登録状態も判定しません。手動での登録または再読み込みが必要です。

Before making changes, setup shows the planned storage folder, file placement, temporary folder, update backup, clipboard change, and opening the browser management page. Review the plan and press Enter to proceed, or Ctrl+C to cancel.
After completing setup and checks in the browser, return to the console and press Enter to see what actually happened: file location, folders created, backup location, clipboard changes, and the request to open the browser. Known changes are also reported if an error occurs.
The BAT only prepares files. It does NOT install, register, or enable the extension in the browser, and does not inspect existing registration. Manual registration or reloading is still required.

### 初回のクリック手順 / First-time click-by-click setup

【初回：クリックする場所を順番に確認】
1. Edgeの場合：右上の「…」（設定など）をクリック →「拡張機能」→「拡張機能の管理」をクリックします。
   Chromeの場合：右上の「︙」（縦の3点）をクリック →「拡張機能」→「拡張機能を管理」をクリックします。
   BATがすでに拡張機能管理画面を開いている場合、この操作は不要です。その画面のまま2へ進みます。
2. 管理画面の「開発者モード」（Chromeでは「デベロッパー モード」）のスイッチをクリックし、オンにします。
   Edgeでは画面左側、Chromeでは右上を探してください。表示位置はバージョンや画面幅により異なる場合があります。
3. 「展開して読み込み」（Chromeでは「パッケージ化されていない拡張機能を読み込む」）をクリックします。
4. フォルダー選択画面が開いたら、下部の「フォルダー」ボックスをクリックし、文字が入っていれば選択してからCtrl+Vでコピー済みのパスを貼り付けます。
   フォルダーボックスがない場合は、画面上部のアドレス欄をクリック（またはCtrl+L）→Ctrl+V→Enterの順に操作します。
5. 貼り付けた先が、末尾に「GDH_Search\Extension」と付くフォルダーであることを確認します。
6. 右下の「フォルダーの選択」（表示によっては「フォルダーを選択」）をクリックします。
7. 管理画面に「GDH 機械情報 拡張検索」が追加され、スイッチがオンになっていることを確認します。
8. GDHの機械情報検索ページへ戻る → ページを再読み込み → 右下の「拡張検索」をクリックします。

First-time setup: exactly where to click
1. Edge: top-right ... (Settings and more) > Extensions > Manage extensions.
   Chrome: top-right three-dot menu > Extensions > Manage extensions.
   If the BAT already opened the extension management page, stay on that page and go to step 2.
2. Turn on Developer mode. In Edge, look on the left; in Chrome, look at the top right. The position may vary by browser version or window width.
3. Click Load unpacked.
4. In the folder selection dialog, click the Folder box near the bottom. Select any existing text and press Ctrl+V to paste the copied path.
   If there is no Folder box, click the address bar at the top (or press Ctrl+L), then press Ctrl+V and Enter.
5. Check that the destination ends in GDH_Search\Extension.
6. Click Select Folder at the bottom right (the wording may vary).
7. Confirm that GDH 機械情報 拡張検索 is listed and its switch is on.
8. Return to the GDH machine information search page, reload it, then click the extension search button at the bottom right.

### BAT実行後の詳しい設定 / Detailed steps after running the BAT

**初めて使う方：Install.batを押した後の設定**


**手順1　黒い画面でブラウザーを選びます**

- 「使用するブラウザーを選択してください（1: Edge / 2: Chrome）」と表示されます。
- 普段GDHにログインしているブラウザーを選びます。
- Edgeの場合はキーボードで半角の 1、Chromeの場合は半角の 2 を入力し、Enterキーを押します。
- マウスで数字をクリックする操作ではありません。
- ブラウザーの拡張機能管理画面が開きます。黒い画面は、設定が終わるまでそのまま残して構いません。
- BATは配置先を自動的にコピーします。この後の貼り付けが終わるまで、ほかの文字やファイルをコピーしないでください。

**手順2　「開発者モード」をオンにします**

- Edgeでは「開発者モード」、Chromeでは「デベロッパー モード」と表示されることがあります。
- 管理画面内のこの名前のスイッチを探し、オンにします。画面が狭い場合はブラウザーを最大化してください。
- これはブラウザーの拡張機能管理画面にある設定です。Windowsの設定を開く必要はありません。
- オンにすると「展開して読み込み」などのボタンが表示されます。
- 本ツールをこの方式で使う間は、開発者モードをオンのままにします。

**手順3　「展開して読み込み」を押します**

- Edgeでは「展開して読み込み」、Chromeでは「パッケージ化されていない拡張機能を読み込む」などの名前です。
- クリックすると、フォルダーを選ぶ小さな画面が開きます。
- 「拡張機能を追加」「ストアを開く」「パッケージ化」などの別のボタンは使いません。

**手順4　拡張機能のフォルダーを指定します**

- フォルダー選択画面の上部にあるアドレス欄をクリックします。「ダウンロード」など、現在の場所が表示されている部分です。
- 場所が分かりにくい場合は、フォルダー選択画面が手前にある状態で Ctrlキーを押しながら Lキーを押します。
- Ctrlキーを押しながら Vキーを押します。BATがコピーした配置先が貼り付けられます。
- Enterキーを押して、そのフォルダーを開きます。
- コピー内容を失った場合は、代わりに次の1行をアドレス欄へ入力し、Enterキーを押してください。

    %LOCALAPPDATA%\GDH_Search\Extension
- 画面下部の「フォルダーの選択」「フォルダーを選択」などのボタンを押します。
- manifest.jsonが入っているExtensionフォルダー自体を選びます。manifest.jsonファイルを開く操作は不要です。
- フォルダー選択画面ではファイルが見えず、空に見えることがあります。その場合も配置先が正しければ選択できます。
- ZIPファイルや、1つ上のGDH_Searchフォルダーを指定しないでください。

**手順5　追加されたことを確認します**

- 管理画面に「GDH 機械情報 拡張検索」が表示されれば、登録できています。
- この拡張機能のスイッチがオンになっていることを確認します。
- 同じ名前が複数ある場合は、以前別の場所から登録したものが残っていないか確認してください。
- 手順6と最後の確認を終えてからBATの黒い画面に戻り、Enterキーを押してください。変更内容のまとめが表示されます。内容を確認し、もう一度Enterキーを押すと終了します。閉じても登録した拡張機能は残ります。

**手順6　GDHで検索画面を開きます**

- 手順1で選んだブラウザーの、普段使うプロファイルでGDHにログインします。別のブラウザーや別のプロファイルには登録されません。
- GDHの「機械情報検索」画面を開きます。
- すでに開いていた場合も、画面上部の丸い矢印、またはCtrl+Rでページを再読み込みします。
- GDHページ右下の「拡張検索」を押します。検索用の追加画面が開けば設定完了です。
- 「GDHからデータ取得」でGDHのデータを取得します。「CSVファイルを出力します。よろしいですか？」の確認では内容を確認して決定します。
- PCに保存済みのCSVを使う場合は「ローカルからデータ取得」を押し、CSVを選びます。
- 取得が終わったら条件を選び、「この条件で検索」を押します。
- 右上の「言語 / Language」から検索画面の日本語／英語を切り替えられます。

**2回目以降・更新するとき**

- 通常の利用時にInstall.batを毎回実行する必要はありません。GDHの機械情報検索画面で「拡張検索」を押します。
- 新しい版へ更新するときだけ、新しいZIPをすべて展開してInstall.batを実行します。
- 同じブラウザーを選び、管理画面にある「GDH 機械情報 拡張検索」の再読み込みボタン（丸い矢印）を押します。
- 初回と同じ配置先から登録済みなら、「展開して読み込み」で追加し直す必要はありません。
- GDHのページも再読み込みしてから「拡張検索」を開いてください。読み込んでいたCSVや入力条件は再読み込みで失われるため、再取得してください。

**うまくいかないとき**

- 管理画面が開かない：ブラウザーのアドレス欄へEdgeは edge://extensions/、Chromeは chrome://extensions/ を入力します。
- フォルダーが見つからない：BATの画面に「配置完了」と出ているか確認してください。エラーの場合は表示内容を確認します。
- 「マニフェストが見つからない」などの表示：フォルダーの選択先が違う可能性があります。手順4のExtensionフォルダーを選び直します。
- 右下にボタンがない：同じブラウザー／プロファイルで開いているか、拡張機能がオンか、GDHの機械情報検索画面かを確認し、GDHページを再読み込みします。
- 会社の制限で実行・登録できない：設定を無理に変更せず、NC戦略 吉田へ表示内容と使用ブラウザーを連絡してください。

Detailed steps after double-clicking Install.bat

**Step 1: Choose your browser in the console window.**

When asked "Choose your browser (1: Edge / 2: Chrome)", type 1 for Edge or 2 for Chrome, then press Enter. Use the browser and profile you normally use for GDH. The number is typed on the keyboard, not clicked.
The extension management page opens. You can leave the console window open until setup is finished. Setup has copied the installation path; avoid copying anything else until you paste it below.

**Step 2: Turn on Developer mode.**

Find the Developer mode switch on the browser extension management page and turn it on. Maximize the browser if needed. This is a browser setting; you do not need Windows Settings.
A Load unpacked button appears. Keep Developer mode on while using this unpacked extension.

**Step 3: Click Load unpacked.**

A folder selection dialog opens. Do not choose Pack extension or open an extension store.

**Step 4: Select the installation folder.**

Click the address bar at the top of the folder selection dialog, where the current location is shown. Alternatively, press Ctrl+L while this dialog is in the foreground.
Press Ctrl+V to paste the path copied by setup, then press Enter to open that folder.
If the clipboard has changed, type this path instead and press Enter:

    %LOCALAPPDATA%\GDH_Search\Extension
Click Select Folder (the exact wording may vary).
Select the Extension folder containing manifest.json, not the file itself. Files may be hidden in a folder-only dialog, so the folder can appear empty.
Do not select the ZIP or the parent GDH_Search folder.

**Step 5: Confirm registration.**

The extension "GDH 機械情報 拡張検索" should now be listed. Make sure its switch is on. The registered extension name remains Japanese even when setup uses English.
If multiple copies are listed, check whether an older copy was loaded from a different location.
After Step 6 and the final checks, return to the console and press Enter to display the change summary. Review it, then press Enter again to close. Closing the console does not remove the extension.

**Step 6: Open the search screen in GDH.**

Log in to GDH using the browser and profile you selected. Installation does not apply to other browsers or profiles.
Open the GDH machine information search page. Reload it using the circular arrow button or Ctrl+R, even if it was already open.
Click the extension search button at the bottom right of the GDH page. The added search screen should open.
Choose Get data from GDH and accept the CSV export confirmation after checking it. Alternatively, choose Load local data and select a saved CSV file.
After loading, set your filters and click the search button. The Language selector at the top right switches the search screen between Japanese and English.

Everyday use and updates
You do not need to run Install.bat every time. Open GDH and click the extension search button.
For an update, extract the new ZIP, run Install.bat, and choose the same browser. On the extension management page, click Reload (the circular arrow) for this extension.
If you already registered the same installation folder, do not add it again with Load unpacked.
Reload the GDH page as well. Reloading clears the loaded CSV and filters, so retrieve the data again.

Troubleshooting
Management page did not open: type edge://extensions/ or chrome://extensions/ in the browser address bar.
Folder not found: check the console for Installation complete or an error message.
Manifest missing: select the Extension folder described in Step 4.
No search button in GDH: check the browser/profile, ensure the extension is enabled, open the GDH machine information search page, and reload it.
Blocked by company restrictions: do not force a settings change. Contact Yoshida, NC Strategy, with the displayed message and browser name.


### 最後の設定確認 / Final setup check

【最後の確認：設定が正しくできたかチェック】

次の項目を上から順に確認してください。
□ 1. 拡張機能管理画面に「GDH 機械情報 拡張検索」があり、スイッチがオンになっている。
□ 2. GDHを使うブラウザー・プロファイルに登録されている。
□ 3. GDHの機械情報検索ページを再読み込みすると、右下に「拡張検索」が表示される。
□ 4. 「拡張検索」を押すと検索画面が開き、閉じてからもう一度開ける。

ここまで確認できれば、拡張機能の登録と画面表示の設定は完了です。
続いて、実際のデータで動作を確認します。

□ 5. 「GDHからデータ取得」を押し、CSV出力確認で決定すると、ダウンロードと画面への読み込みが完了する。
      保存済みCSVを使う場合は「ローカルからデータ取得」で読み込みます。この場合、GDHからの取得動作は未確認です。
□ 6. 画面の読込件数を確認する。0件の場合はGDH側の検索条件やCSVの内容を確認する。
□ 7. 取り込んだデータにある機械シリアルまたはNCシリアルを1つ入力し、「この条件で検索」を押すと、該当する行が表示される。
□ 8. 表示された行を押して詳細を開き、入力したシリアルとCSVの内容が一致していることを確認する。
□ 9. 「条件クリア」で検索条件を解除でき、日本語／英語の切替もできる。

確認結果の目安：
・1～4がすべてOK：導入・画面表示の設定完了。
・5～9もすべてOK：使用したCSVで基本動作を確認済み。
・GDHからの取得を実施していない：ローカルCSVの読込・検索のみ確認済み。
これは利用者が画面を見て行う確認です。BATがブラウザーの登録状態やGDHの動作を自動判定するものではなく、動作保証を意味するものでもありません。

確認できない項目があった場合：
上記の項目番号、拡張機能のバージョン、ブラウザー名、表示されたメッセージをNC戦略 吉田へ連絡してください。実CSVや顧客情報は添付せず、画面を送る場合も顧客名・シリアル番号などを隠してください。

Final check: confirm that setup worked

Check each item in order:
[ ] 1. GDH 機械情報 拡張検索 is listed on the browser extension management page and its switch is on.
[ ] 2. It is registered in the browser and profile you use for GDH.
[ ] 3. Reloading the GDH machine information search page shows the extension search button at the bottom right.
[ ] 4. The button opens the search screen; you can close it and open it again.

If items 1–4 pass, registration and screen setup are complete. Next, check basic operation with real data:

[ ] 5. Choose Get data from GDH, accept the CSV export confirmation, and confirm that the download and loading complete.
        Alternatively, use Load local data with a saved CSV. This does not verify retrieval from GDH.
[ ] 6. Check the loaded row count. If it is zero, check the GDH filters or CSV contents.
[ ] 7. Enter a machine serial or NC serial known to be in the loaded CSV and search. Confirm that the expected row appears.
[ ] 8. Open the row details and compare the serial and contents with the CSV.
[ ] 9. Clear the filters and confirm that Japanese / English switching works.

Results:
Items 1–4 pass: installation and screen setup are complete.
Items 5–9 also pass: basic operation has been checked with the CSV used.
If you only used a local CSV, GDH retrieval has not been verified.
These are checks performed by the user. The BAT does not automatically inspect browser registration or GDH operation. Passing these checks is not a guarantee of operation.

If a check fails, contact Yoshida, NC Strategy, with the item number, extension version, browser name and displayed message. Do not attach actual CSV or customer data; hide customer names and serial numbers in screenshots.

### 拡張機能を有効にする（Chrome / Edge）

1. [ダウンロードページ](https://github.com/yoshidak1121-cmd/GDH_search/releases/tag/v1.11.1)から **GDH_Search_Extension_v1.11.1.zip** をダウンロードします。
2. ZIPファイルを右クリックし、**「すべて展開」**を選びます。展開したフォルダーは、拡張機能を使う間は削除・移動しないでください。
3. ブラウザーのアドレス欄に、Edgeの場合は `edge://extensions/`、Chromeの場合は `chrome://extensions/` を入力して開きます。
4. **「開発者モード」または「デベロッパー モード」**をオンにします。
5. **「展開して読み込み」または「パッケージ化されていない拡張機能を読み込む」**をクリックします。
6. 展開先の **GDH_Search_Extension** フォルダーを選びます。`manifest.json` が入っているフォルダーを指定してください。ZIPファイル自体は選びません。
7. 追加された **GDH 機械情報 拡張検索** のスイッチがオンになっていることを確認します。

すでに登録済みの場合は、拡張機能管理画面でスイッチをオンにしてください。

### 拡張検索画面を開く

1. GDHにログインし、**機械情報検索画面を開いて再読み込み**します。
2. ページ右下の **「拡張検索」**をクリックすると、検索画面が開きます。
3. ブラウザー右上の **拡張機能マーク（パズルの形）→ GDH 拡張検索 →「拡張検索を開く／閉じる」**からも開けます。
4. **「GDHからデータ取得」**でGDHのCSVを取得するか、**「ローカルからデータ取得」**でPCに保存済みのCSVを選びます。

ボタンが表示されない場合は、拡張機能が有効か確認し、GDHの機械情報検索画面を再読み込みしてください。対象のGDH画面以外では開けません。

### 拡張機能を更新する

新しいZIPを展開し、登録したフォルダー内のファイルを更新します。拡張機能管理画面の **再読み込みボタン**を押し、GDHのページも再読み込みしてください。展開先を変更した場合は、古い拡張機能を削除し、新しいフォルダーを読み込み直してください。

詳細は [拡張機能の導入手順](EXTENSION_INSTALL.md)を参照してください。

単独利用は `index.html` をEdge / Chromeで開き、「ローカルからデータ取得」から読み込みます。開発サーバーやnpmは不要です。

GDHからの自動取得は、提供された画面HTMLで確認した既存CSV出力フォームを使います。圧縮なしのCSVをダウンロードし、同じデータを検索へ反映します。ユーザーからGDH本番での取得成功の報告があります。フォーム仕様は `GDH_INTEGRATION.md` を参照してください。

## 操作デモ

`node scripts/build-demo.cjs` で `dist/GDH_Search_Demo/GDH_Search_Demo.html` を生成します。架空24件を自動読込し、OR／AND（8件）、メーカー追加（2件）、エンドユーザーの表記揺れ（6件）を試せます。本番へは接続しません。

## データと検証

CSVはWorker内で処理し、外部サービス、localStorage、IndexedDBへ保存しません。ダウンロードしたCSVは通常の保存先に残ります。referenceの実CSV・保存HTML・画面画像は配布アーカイブに含めません。リポジトリは非公開です。オープンソースライセンスは付与していません。

`node tests/smoke.cjs` でWorkerの解析・検索を検証します。開発用Playwrightが利用可能な環境で `node tests/facets.cjs`、`node tests/extension.cjs`、`node tests/gdh-export.cjs` を実行できます。`TEST_BROWSER_CHANNEL=msedge`、拡張機能試験は `TEST_EXTENSION_CHANNEL=msedge` でEdgeを指定できます。アプリ本体に外部ライブラリは不要です。詳細は `RELEASE_CHECKLIST.md` を参照してください。

画面上部に「本画面は個人が作成した拡張画面であり、GDHの標準機能ではありません。ベータ版のため、動作保証およびサポートは提供していません。」「同様の拡張画面の独自制作をご希望の場合は、NC戦略 吉田までご相談ください。」を表示します。

GDHからの取得中のメッセージは取得ボタン直下に表示します。通常30秒〜1分かかります。5分以上動きがない場合はGDHからCSVを手動でダウンロードし、「ローカルからデータ取得」で読み込んでください。通信エラーが先に表示された場合も、手動取得へ切り替えられます。
Retrieval status appears below Get data from GDH. Retrieval usually takes 30 seconds to 1 minute. If there is no activity for more than 5 minutes, download the CSV manually and use Load local data. You may also switch to manual retrieval if a connection error appears earlier.

導入操作の参考 / Installation references: [Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading), [Google Chrome](https://support.google.com/chrome/answer/2664769?hl=en).

IDで終わる列を含め、CSVの全項目を保持します。現在の33列CSVは33列すべてを読み込み、詳細表示・全項目検索でも利用できます。元CSVは変更しません。
All CSV columns, including those ending in ID, are retained. All 33 columns in the current CSV remain available for record details and all-column search. Original CSV files are unchanged.

## ダッシュボードの2画面化

機械情報検索のダッシュボード内で「機械統計」「データ保守」を切り替えます。統計は輸出国・輸入国・機械メーカー・エンドユーザー・契約タイプのレコード件数／構成比を表示し、棒から一覧へ絞り込めます。各分類とサービス拠点の複合条件も利用できます。画面切替時は条件を解除します。

データ保守は既存の5重要項目の欠損・NCシリアル再登場に加え、全セルの原文が一致する完全重複行（先頭行を含む）と、名称・国・契約タイプのNFKC／大小文字／空白の差による表記揺れ候補を表示します。候補率の分母は絞込後の行数、候補グループ一覧はCSV全体の最大100組です。識別子は正規化せず、自動修正・統合は行いません。


## v1.11.0 参考検索・空欄率

「詳細条件」を開くと「参考検索（データ空欄が多く参考データ）」を表示します。NCシステム型名、工作機械名（CSVの工作機械モデル番号）、サービス拠点、契約期間（月）、契約開始日、契約元拠点、契約者名、販売会社、機械出荷日を検索できます。項目同士はAND、同一項目の追加条件はORです。契約期間・日付は入力値の部分一致／前方一致／完全一致で検索します。日付の入力形式はCSVの表記に合わせてください。

データ保守の「各項目の空欄率」は、適用済み条件の対象レコード数を分母として、読み込んだ全列の空欄件数と割合を表示します。空白文字のみのセルも空欄です。対象0件では割合を「—」と表示します。
