/* Mount the viewer in an authorized, same-origin GDH extension area. */
(function () {
 'use strict';
 window.mountCncMachineViewer = function (container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new Error('表示先のHTML要素を指定してください。');
  if (!options.viewerUrl) throw new Error('管理者が配置したビューアのURLを指定してください。');
  const url = new URL(options.viewerUrl, location.href);
  if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) throw new Error('GDHと同じオリジンのビューアURLを指定してください。');
  if (options.exportCsv != null && typeof options.exportCsv !== 'function') throw new Error('exportCsvには関数を指定してください。');
  url.searchParams.set('embedded', '1');
  const frame = document.createElement('iframe');
  frame.title = 'CNC機械情報検索';
  frame.style.cssText = 'display:block;width:100%;height:100%;min-height:850px;border:0;';
  frame.addEventListener('load', function () {
   if (!options.exportCsv) return;
   // Adapt parent-window Blob/Response objects to the viewer's JavaScript realm.
   frame.contentWindow.GDH_CSV_EXPORT_ADAPTER = async function () {
    const result = await options.exportCsv();
    let blob, fileName = 'GDH_machine_export.csv';
    if (result instanceof Response) {
     if (!result.ok) throw new Error('GDH CSV export failed: ' + result.status);
     blob = await result.blob();
    } else if (result instanceof Blob) blob = result;
    else if (result && result.blob instanceof Blob) { blob = result.blob; fileName = result.fileName || fileName; }
    else throw new Error('exportCsvはCSVのBlob、Response、または{blob,fileName}を返す必要があります。');
    return { blob: new frame.contentWindow.Blob([blob], {type: blob.type || 'text/csv'}), fileName };
   };
  });
  frame.src = url.href;
  container.appendChild(frame);
  return frame;
 };
})();
