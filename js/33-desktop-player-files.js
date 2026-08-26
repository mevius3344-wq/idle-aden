// 本機桌面玩家資料同步：透過 _serve.js API 讀寫「桌面/天堂玩家資料」（說明標題為躺著變強）。
// 僅 localhost／127.0.0.1；線上版（Render）不會啟用。
(function () {
  'use strict';

  var _ready = null; // null=未探測, true/false
  var _dir = '';

  function _isLocalHost() {
    try {
      var h = (location && location.hostname) || '';
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    } catch (e) {
      return false;
    }
  }

  function _xhrJson(method, url, body, sync) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, !sync);
    if (body != null) xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    if (sync) {
      try {
        xhr.send(body != null ? body : null);
      } catch (e) {
        return { ok: false, status: 0, data: null };
      }
      var data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (e2) {
        data = null;
      }
      return { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: data };
    }
    xhr.send(body != null ? body : null);
    return null;
  }

  function desktopPlayerReady() {
    if (!_isLocalHost()) {
      _ready = false;
      return false;
    }
    if (_ready === true) return true;
    if (_ready === false) return false;
    var r = _xhrJson('GET', '/api/player-data/status', null, true);
    if (r && r.ok && r.data && r.data.ok) {
      _ready = true;
      _dir = r.data.dir || '';
      try {
        console.info('[desktop-player] 玩家資料目錄：', _dir);
      } catch (e) {}
      return true;
    }
    _ready = false;
    return false;
  }

  function desktopPlayerDir() {
    return _dir || '';
  }

  function _parseLzPayload(raw) {
    if (raw == null || raw === '') return null;
    try {
      if (typeof _saveUnwrap === 'function') {
        var u = _saveUnwrap(raw);
        if (u && u.signed && !u.ok) return null;
        if (u && u.payload != null) return JSON.parse(u.payload);
      }
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function desktopPushSlot(slot, dataObj) {
    if (!desktopPlayerReady()) return;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    if (!dataObj || typeof dataObj !== 'object' || !dataObj.p) return;
    try {
      fetch('/api/player-data/slot/' + slot, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataObj),
      }).catch(function () {});
    } catch (e) {}
  }

  function desktopPullSlotIntoStorage(slot) {
    if (!desktopPlayerReady()) return false;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    var r = _xhrJson('GET', '/api/player-data/slot/' + slot, null, true);
    if (!r || r.status === 404) return false;
    if (!r.ok || !r.data || !r.data.ok || !r.data.data || !r.data.data.p) return false;
    try {
      var payload = JSON.stringify(r.data.data);
      var wrapped = typeof _saveWrap === 'function' ? _saveWrap(payload) : payload;
      if (typeof _lzSet !== 'function') return false;
      return !!_lzSet('lineage_idle_save_' + slot, wrapped);
    } catch (e) {
      return false;
    }
  }

  function desktopDeleteSlot(slot) {
    if (!desktopPlayerReady()) return;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    try {
      fetch('/api/player-data/slot/' + slot, { method: 'DELETE' }).catch(function () {});
    } catch (e) {}
  }

  function _sharedName(kind) {
    var classic = !!(typeof player !== 'undefined' && player && player.classicMode);
    if (kind === 'warehouse') return classic ? 'warehouse_classic' : 'warehouse';
    if (kind === 'pets') return classic ? 'pets_classic' : 'pets';
    return null;
  }

  function desktopPushShared(name, dataObj) {
    if (!desktopPlayerReady() || !name) return;
    try {
      fetch('/api/player-data/shared/' + encodeURIComponent(name), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataObj == null ? {} : dataObj),
      }).catch(function () {});
    } catch (e) {}
  }

  function desktopPullSharedIntoStorage(name, storageKey) {
    if (!desktopPlayerReady() || !name || !storageKey) return false;
    var r = _xhrJson('GET', '/api/player-data/shared/' + encodeURIComponent(name), null, true);
    if (!r || r.status === 404) return false;
    if (!r.ok || !r.data || !r.data.ok) return false;
    try {
      var payload = JSON.stringify(r.data.data);
      if (typeof _lzSet !== 'function') return false;
      return !!_lzSet(storageKey, payload);
    } catch (e) {
      return false;
    }
  }

  function desktopMirrorAfterSave(slot) {
    if (!desktopPlayerReady()) return;
    slot = slot || (typeof currentSlot !== 'undefined' ? currentSlot : 1);
    try {
      var raw = typeof _lzGet === 'function' ? _lzGet('lineage_idle_save_' + slot) : null;
      var data = _parseLzPayload(raw);
      if (data && data.p) desktopPushSlot(slot, data);
    } catch (e) {}
    try {
      var wKey =
        typeof WH_KEY !== 'undefined'
          ? WH_KEY +
            (typeof modeSuffix === 'function'
              ? modeSuffix(!!(player && player.classicMode), !!(player && player.traditionalMode))
              : '')
          : null;
      if (wKey && typeof _lzGet === 'function') {
        var wr = _lzGet(wKey);
        if (wr != null && wr !== '') {
          try {
            desktopPushShared(_sharedName('warehouse'), JSON.parse(wr));
          } catch (e3) {}
        }
      }
    } catch (e4) {}
    try {
      var pKey =
        (typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster') +
        (typeof modeSuffix === 'function' ? modeSuffix(!!(player && player.classicMode), false) : '');
      if (typeof _lzGet === 'function') {
        var pr = _lzGet(pKey);
        if (pr != null && pr !== '') {
          try {
            desktopPushShared(_sharedName('pets'), JSON.parse(pr));
          } catch (e5) {}
        }
      }
    } catch (e6) {}
  }

  function desktopPullBeforeLoad(slot) {
    if (!desktopPlayerReady()) return false;
    slot = slot || (typeof currentSlot !== 'undefined' ? currentSlot : 1);
    var pulled = desktopPullSlotIntoStorage(slot);
    try {
      var classicGuess = false;
      try {
        var raw = typeof _lzGet === 'function' ? _lzGet('lineage_idle_save_' + slot) : null;
        var d = _parseLzPayload(raw);
        classicGuess = !!(d && d.p && d.p.classicMode);
      } catch (e) {}
      var wName = classicGuess ? 'warehouse_classic' : 'warehouse';
      var wKey =
        (typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse') +
        (classicGuess ? '_classic' : '');
      desktopPullSharedIntoStorage(wName, wKey);
      var pName = classicGuess ? 'pets_classic' : 'pets';
      var pKey =
        (typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster') +
        (classicGuess ? '_classic' : '');
      desktopPullSharedIntoStorage(pName, pKey);
    } catch (e2) {}
    return pulled;
  }

  // 首次就緒：把瀏覽器既有存檔補寫到桌面（桌面尚無該檔時）
  function desktopBootstrapFromLocal() {
    if (!desktopPlayerReady()) return;
    for (var i = 1; i <= 8; i++) {
      (function (slot) {
        try {
          fetch('/api/player-data/slot/' + slot)
            .then(function (res) {
              if (res.status === 404) {
                var raw = typeof _lzGet === 'function' ? _lzGet('lineage_idle_save_' + slot) : null;
                var data = _parseLzPayload(raw);
                if (data && data.p) desktopPushSlot(slot, data);
              }
            })
            .catch(function () {});
        } catch (e) {}
      })(i);
    }
    ['warehouse', 'warehouse_classic', 'pets', 'pets_classic'].forEach(function (name) {
      try {
        var key =
          name.indexOf('warehouse') === 0
            ? (typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse') +
              (name.indexOf('classic') >= 0 ? '_classic' : '')
            : (typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster') +
              (name.indexOf('classic') >= 0 ? '_classic' : '');
        fetch('/api/player-data/shared/' + name)
          .then(function (res) {
            if (res.status === 404 && typeof _lzGet === 'function') {
              var raw = _lzGet(key);
              if (raw != null && raw !== '') {
                try {
                  desktopPushShared(name, JSON.parse(raw));
                } catch (e) {}
              }
            }
          })
          .catch(function () {});
      } catch (e2) {}
    });
  }

  try {
    if (_isLocalHost()) {
      setTimeout(function () {
        try {
          if (desktopPlayerReady()) desktopBootstrapFromLocal();
        } catch (e) {}
      }, 800);
    }
  } catch (e) {}

  window.desktopPlayerReady = desktopPlayerReady;
  window.desktopPlayerDir = desktopPlayerDir;
  window.desktopPushSlot = desktopPushSlot;
  window.desktopPullSlotIntoStorage = desktopPullSlotIntoStorage;
  window.desktopDeleteSlot = desktopDeleteSlot;
  window.desktopMirrorAfterSave = desktopMirrorAfterSave;
  window.desktopPullBeforeLoad = desktopPullBeforeLoad;
  window.desktopBootstrapFromLocal = desktopBootstrapFromLocal;
})();
