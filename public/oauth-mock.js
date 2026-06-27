// 模擬 ZENPRAX Cloud OAuth ポータル。実在の認可エンドポイントが未整備のため、
// 承認シグナルを window.opener (popup) へ postMessage で返すだけのデモ実装。
(function () {
  'use strict';

  var approve = document.getElementById('approve');
  var cancel = document.getElementById('cancel');
  var done = document.getElementById('done');

  function signalSuccess() {
    var payload = { source: 'kiba-oauth', status: 'success' };
    try {
      if (window.opener) {
        window.opener.postMessage(payload, '*');
      }
    } catch (e) {
      // opener が閉じている等。無視する。
    }
  }

  approve.addEventListener('click', function () {
    approve.disabled = true;
    approve.textContent = '接続中…';
    // わずかに遅延させ、リダイレクト往復のような体験を演出する。
    window.setTimeout(function () {
      signalSuccess();
      done.textContent = '接続しました。このウィンドウは自動的に閉じます。';
      window.setTimeout(function () {
        window.close();
      }, 700);
    }, 500);
  });

  cancel.addEventListener('click', function () {
    window.close();
  });
})();
