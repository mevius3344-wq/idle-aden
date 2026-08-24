// 雲端共用存檔：寫入伺服器 data/cloud/<帳號>/，載入優先讀雲端。
// 依目前登入帳號分桶（localStorage 作快取）。
(function () {
  'use strict';

  var _ready = null; // null unknown, true/false

  function currentAccount() {
    try {
      if (window.__fb5AuthAccount) return String(window.__fb5AuthAccount);
      if (window.GameAccountAuth && typeof window.GameAccountAuth.currentAccount === 'function') {
        var a = window.GameAccountAuth.currentAccount();
        if (a) return String(a);
      }
    } catch (e) {}
    return 'guest';
  }

  function _httpOk() {
    try {
      return location.protocol === 'http:' || location.protocol === 'https:';
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

  function cloudReady() {
    if (!_httpOk()) {
      _ready = false;
      return false;
    }
    if (_ready === true) return true;
    if (_ready === false) return false;
    var r = _xhrJson('GET', '/api/cloud/status', null, true);
    if (r && r.ok && r.data && r.data.ok) {
      _ready = true;
      try {
        console.info('[cloud-save] 已啟用雲端存檔', r.data.dir || '');
        if (r.data.ephemeralHint) {
          console.warn('[cloud-save] Render 免費碟為暫存：重新部署可能清空，建議設定 CLOUD_SAVE_DIR 持久碟');
        }
      } catch (e) {}
      return true;
    }
    _ready = false;
    return false;
  }

  function _base() {
    return '/api/cloud/' + encodeURIComponent(currentAccount());
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

  function _sharedName(kind, classic) {
    if (kind === 'warehouse') return classic ? 'warehouse_classic' : 'warehouse';
    if (kind === 'pets') return classic ? 'pets_classic' : 'pets';
    return null;
  }

  function cloudPushSlot(slot, dataObj) {
    if (!cloudReady()) return;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    if (!dataObj || typeof dataObj !== 'object' || !dataObj.p) return;
    try {
      fetch(_base() + '/slot/' + slot, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataObj),
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudPullSlotIntoStorage(slot) {
    if (!cloudReady()) return false;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    var r = _xhrJson('GET', _base() + '/slot/' + slot, null, true);
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

  function cloudDeleteSlot(slot) {
    if (!cloudReady()) return;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    try {
      fetch(_base() + '/slot/' + slot, { method: 'DELETE' }).catch(function () {});
    } catch (e) {}
  }

  function cloudPushShared(name, dataObj) {
    if (!cloudReady() || !name) return;
    try {
      fetch(_base() + '/shared/' + encodeURIComponent(name), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataObj == null ? {} : dataObj),
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudPullSharedIntoStorage(name, storageKey) {
    if (!cloudReady() || !name || !storageKey) return false;
    var r = _xhrJson('GET', _base() + '/shared/' + encodeURIComponent(name), null, true);
    if (!r || r.status === 404) return false;
    if (!r.ok || !r.data || !r.data.ok) return false;
    try {
      var payload = JSON.stringify(r.data.data);
      // pets 桶可能有 SIG wrap；倉庫是純 JSON
      if (name.indexOf('pets') === 0 && typeof _saveWrap === 'function') {
        payload = _saveWrap(payload);
      }
      if (typeof _lzSet !== 'function') return false;
      return !!_lzSet(storageKey, payload);
    } catch (e) {
      return false;
    }
  }

  function cloudMirrorAfterSave(slot) {
    if (!cloudReady()) return;
    slot = slot || (typeof currentSlot !== 'undefined' ? currentSlot : 1);
    try {
      var raw = typeof _lzGet === 'function' ? _lzGet('lineage_idle_save_' + slot) : null;
      var data = _parseLzPayload(raw);
      if (data && data.p) cloudPushSlot(slot, data);
    } catch (e) {}
    try {
      var classic = !!(typeof player !== 'undefined' && player && player.classicMode);
      var wKey =
        (typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse') +
        (typeof modeSuffix === 'function'
          ? modeSuffix(classic, !!(player && player.traditionalMode))
          : classic
            ? '_classic'
            : '');
      if (typeof _lzGet === 'function') {
        var wr = _lzGet(wKey);
        if (wr != null && wr !== '') {
          try {
            cloudPushShared(_sharedName('warehouse', classic), JSON.parse(wr));
          } catch (e3) {}
        }
      }
      var pKey =
        (typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster') +
        (typeof modeSuffix === 'function' ? modeSuffix(classic, false) : classic ? '_classic' : '');
      if (typeof _lzGet === 'function') {
        var pr = _lzGet(pKey);
        if (pr != null && pr !== '') {
          try {
            var pets = _parseLzPayload(pr);
            if (pets == null) pets = JSON.parse(pr);
            cloudPushShared(_sharedName('pets', classic), pets);
          } catch (e5) {}
        }
      }
    } catch (e4) {}
  }

  function cloudPullBeforeLoad(slot) {
    if (!cloudReady()) return false;
    slot = slot || (typeof currentSlot !== 'undefined' ? currentSlot : 1);
    var pulled = cloudPullSlotIntoStorage(slot);
    try {
      var classicGuess = false;
      try {
        var raw = typeof _lzGet === 'function' ? _lzGet('lineage_idle_save_' + slot) : null;
        var d = _parseLzPayload(raw);
        classicGuess = !!(d && d.p && d.p.classicMode);
      } catch (e) {}
      var wName = _sharedName('warehouse', classicGuess);
      var wKey =
        (typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse') +
        (classicGuess ? '_classic' : '');
      cloudPullSharedIntoStorage(wName, wKey);
      var pName = _sharedName('pets', classicGuess);
      var pKey =
        (typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster') +
        (classicGuess ? '_classic' : '');
      cloudPullSharedIntoStorage(pName, pKey);
    } catch (e2) {}
    return pulled;
  }

  function cloudApplyBundle(bundle) {
    if (!bundle || !bundle.ok) return false;
    var any = false;
    try {
      if (bundle.slots) {
        Object.keys(bundle.slots).forEach(function (k) {
          var data = bundle.slots[k];
          if (!data || !data.p) return;
          var payload = JSON.stringify(data);
          var wrapped = typeof _saveWrap === 'function' ? _saveWrap(payload) : payload;
          if (typeof _lzSet === 'function' && _lzSet('lineage_idle_save_' + k, wrapped)) any = true;
        });
      }
      if (bundle.shared) {
        var map = {
          warehouse: typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse',
          warehouse_classic:
            (typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse') + '_classic',
          pets: typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster',
          pets_classic:
            (typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster') + '_classic',
        };
        Object.keys(map).forEach(function (name) {
          if (!bundle.shared[name]) return;
          var payload = JSON.stringify(bundle.shared[name]);
          if (name.indexOf('pets') === 0 && typeof _saveWrap === 'function') payload = _saveWrap(payload);
          if (typeof _lzSet === 'function' && _lzSet(map[name], payload)) any = true;
        });
      }
    } catch (e) {}
    return any;
  }

  function cloudPullBundleSync() {
    if (!cloudReady()) return false;
    var r = _xhrJson('GET', _base() + '/bundle', null, true);
    if (!r || !r.ok || !r.data || !r.data.ok) return false;
    return cloudApplyBundle(r.data);
  }

  // 雲端尚空時，把本機既有存檔上傳當種子
  function cloudBootstrapFromLocal() {
    if (!cloudReady()) return;
    for (var i = 1; i <= 8; i++) {
      (function (slot) {
        try {
          fetch(_base() + '/slot/' + slot)
            .then(function (res) {
              if (res.status === 404 && typeof _lzGet === 'function') {
                var raw = _lzGet('lineage_idle_save_' + slot);
                var data = _parseLzPayload(raw);
                if (data && data.p) cloudPushSlot(slot, data);
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
        fetch(_base() + '/shared/' + name)
          .then(function (res) {
            if (res.status === 404 && typeof _lzGet === 'function') {
              var raw = _lzGet(key);
              if (raw == null || raw === '') return;
              try {
                var obj =
                  name.indexOf('pets') === 0 ? _parseLzPayload(raw) || JSON.parse(raw) : JSON.parse(raw);
                cloudPushShared(name, obj);
              } catch (e) {}
            }
          })
          .catch(function () {});
      } catch (e2) {}
    });
  }

  function cloudSyncOnLogin() {
    if (!cloudReady()) return Promise.resolve(false);
    return fetch(_base() + '/bundle')
      .then(function (res) {
        return res.json().then(function (data) {
          var hasSlots = data && data.slots && Object.keys(data.slots).length > 0;
          if (hasSlots) {
            cloudApplyBundle(data);
            return true;
          }
          cloudBootstrapFromLocal();
          return false;
        });
      })
      .catch(function () {
        return false;
      });
  }

  try {
    if (_httpOk()) {
      setTimeout(function () {
        try {
          if (cloudReady()) {
            // 進站先拉雲端（有資料就覆蓋本機快取），沒有則上傳本機種子
            var r = _xhrJson('GET', _base() + '/bundle', null, true);
            if (r && r.ok && r.data && r.data.ok) {
              var has =
                (r.data.slots && Object.keys(r.data.slots).length > 0) ||
                (r.data.shared && Object.keys(r.data.shared).length > 0);
              if (has) cloudApplyBundle(r.data);
              else cloudBootstrapFromLocal();
            }
          }
        } catch (e) {}
      }, 500);
    }
  } catch (e) {}

  window.cloudReady = cloudReady;
  window.cloudPushSlot = cloudPushSlot;
  window.cloudPullSlotIntoStorage = cloudPullSlotIntoStorage;
  window.cloudDeleteSlot = cloudDeleteSlot;
  window.cloudMirrorAfterSave = cloudMirrorAfterSave;
  window.cloudPullBeforeLoad = cloudPullBeforeLoad;
  window.cloudPullBundleSync = cloudPullBundleSync;
  window.cloudBootstrapFromLocal = cloudBootstrapFromLocal;
  window.cloudSyncOnLogin = cloudSyncOnLogin;
})();
