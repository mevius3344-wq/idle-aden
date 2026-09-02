// 雲端共用存檔：寫入伺服器 data/cloud/<帳號>/，載入優先讀雲端。
// 依目前登入帳號分桶（localStorage 作快取）。
// ⚠️ 合併原則：同槽位永不「舊蓋新／貧蓋富」；登入不同帳號不把他人本機進度灌進自己的雲端。
(function () {
  'use strict';

  var _ready = null; // null unknown, true/false
  var _readyCheckedAt = 0;
  var _conflictNotified = false;

  function currentAccount() {
    try {
      if (window.__fb5AuthAccount) return String(window.__fb5AuthAccount);
      if (window.GameAccountAuth && typeof window.GameAccountAuth.currentAccount === 'function') {
        var a = window.GameAccountAuth.currentAccount();
        if (a) return String(a);
      }
    } catch (e) {}
    return '';
  }

  function cloudLoggedIn() {
    var a = String(currentAccount() || '').trim();
    return !!(a && a.toLowerCase() !== 'guest');
  }

  /** 伺服器有雲端 API 且已登入帳號（非 guest 共用桶） */
  function cloudCanSync() {
    return cloudReady() && cloudLoggedIn();
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

  function cloudReady(forceRecheck) {
    if (!_httpOk()) {
      _ready = false;
      return false;
    }
    if (forceRecheck) _ready = null;
    else if (_ready === false && Date.now() - _readyCheckedAt < 60000) return false;
    else if (_ready === false && Date.now() - _readyCheckedAt >= 60000) _ready = null;
    if (_ready === true) return true;
    if (_ready === false) return false;
    // 未知狀態：不阻塞主執行緒，背景探測後再同步
    if (_ready === null) {
      cloudReadyAsync(true);
      return false;
    }
    return false;
  }

  function cloudReadyAsync(forceRecheck) {
    if (!_httpOk()) {
      _ready = false;
      return Promise.resolve(false);
    }
    if (!forceRecheck && _ready === true) return Promise.resolve(true);
    if (!forceRecheck && _ready === false && Date.now() - _readyCheckedAt < 60000) {
      return Promise.resolve(false);
    }
    _readyCheckedAt = Date.now();
    return fetch('/api/cloud/status', { method: 'GET', cache: 'no-store' })
      .then(function (res) {
        return res.json().then(function (data) {
          if (res.ok && data && data.ok) {
            _ready = true;
            try {
              console.info('[cloud-save] 已啟用雲端存檔', data.dir || '');
            } catch (e) {}
            return true;
          }
          _ready = false;
          return false;
        });
      })
      .catch(function () {
        _ready = false;
        return false;
      });
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

  function _ownerOf(data) {
    if (!data) return '';
    var o = (data.p && data.p.cloudOwner) || data.cloudOwner || '';
    return String(o || '').trim();
  }

  function _localBelongsToCurrent(data, allowOwnerless) {
    if (!data || !data.p) return false;
    var owner = _ownerOf(data);
    var acc = String(currentAccount() || '').trim();
    if (!acc) return false;
    // 無 cloudOwner 的舊檔：預設不視為「目前帳號」（避免乙機殘留存檔灌進甲機雲端蓋掉進度）
    // 僅在雲端全空、需本機種子時顯式 allowOwnerless
    if (!owner) return allowOwnerless === true;
    return owner.toLowerCase() === acc.toLowerCase();
  }

  /** 明確標了「其他帳號」才算串帳；無標記舊檔不算他帳（可與雲端比進度合併） */
  function _isForeignAccountSave(data) {
    if (!data || !data.p) return false;
    var owner = _ownerOf(data);
    if (!owner) return false;
    var acc = String(currentAccount() || '').trim();
    if (!acc) return true;
    return owner.toLowerCase() !== acc.toLowerCase();
  }

  /** 進度分數：等級／經驗／金幣／背包量；同進度再比 savedAt */
  function cloudSaveProgressScore(data) {
    var p = data && data.p;
    if (!p || !p.cls) return -1;
    var lv = Math.max(1, Math.floor(Number(p.lv) || 1));
    var exp = Math.max(0, Math.floor(Number(p.exp) || 0));
    var gold = Math.max(0, Math.floor(Number(p.gold) || 0));
    var invN = 0;
    if (Array.isArray(p.inv)) {
      for (var i = 0; i < p.inv.length; i++) {
        var it = p.inv[i];
        invN += Math.max(1, Math.floor(Number(it && it.cnt) || 1));
      }
    }
    return lv * 1e12 + exp * 1e3 + Math.min(gold, 1e11) + invN;
  }

  function cloudSaveTime(data) {
    if (!data) return 0;
    var t = Number((data.p && data.p.savedAt) || data.savedAt || 0);
    return Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
  }

  function cloudSaveEnSeed(data) {
    return String((data && data.p && data.p.enSeed) || '');
  }

  function cloudSameCharacterIdentity(a, b) {
    if (!a || !a.p || !b || !b.p) return true;
    var sa = cloudSaveEnSeed(a);
    var sb = cloudSaveEnSeed(b);
    if (sa && sb) return sa === sb;
    if (sa || sb) return false;
    var na = String(a.p.name || '').trim();
    var nb = String(b.p.name || '').trim();
    var ca = String(a.p.cls || '');
    var cb = String(b.p.cls || '');
    if (na && nb && ca && cb) return na === nb && ca === cb;
    return true;
  }

  function _notifyConflict(msg) {
    if (_conflictNotified) return;
    _conflictNotified = true;
    try {
      if (typeof logSys === 'function') {
        logSys('<span class="text-amber-300 font-bold">☁ ' + msg + '</span>');
      } else {
        console.warn('[cloud-save]', msg);
      }
    } catch (e) {}
  }

  function _backupConflictingLocal(slot, dataObj) {
    if (!dataObj || !dataObj.p || typeof _lzSet !== 'function') return;
    try {
      var payload = JSON.stringify({ backedUpAt: Date.now(), reason: 'identity_conflict', data: dataObj });
      var wrapped = typeof _saveWrap === 'function' ? _saveWrap(payload) : payload;
      _lzSet('lineage_idle_save_' + slot + '_device_bak', wrapped);
    } catch (e) {}
  }

  /** 登入拉雲端時：同槽若為不同角色，以雲端為準（避免手機／電腦互蓋） */
  function _preferCloudOnIdentityConflict(localData, cloudData) {
    if (!localData || !localData.p || !cloudData || !cloudData.p) return false;
    return !cloudSameCharacterIdentity(localData, cloudData);
  }

  /** a 是否應取代 b（富／新勝貧／舊） */
  function cloudSaveBeats(a, b) {
    if (!a || !a.p) return false;
    if (!b || !b.p) return true;
    var sa = cloudSaveProgressScore(a);
    var sb = cloudSaveProgressScore(b);
    if (sa !== sb) return sa > sb;
    return cloudSaveTime(a) >= cloudSaveTime(b);
  }

  function _writeSlotLocal(slot, dataObj) {
    if (!dataObj || !dataObj.p || typeof _lzSet !== 'function') return false;
    try {
      var payload = JSON.stringify(dataObj);
      var wrapped = typeof _saveWrap === 'function' ? _saveWrap(payload) : payload;
      return !!_lzSet('lineage_idle_save_' + slot, wrapped);
    } catch (e) {
      return false;
    }
  }

  function _readSlotLocal(slot) {
    if (typeof _lzGet !== 'function') return null;
    try {
      return _parseLzPayload(_lzGet('lineage_idle_save_' + slot));
    } catch (e) {
      return null;
    }
  }

  function _removeSlotLocal(slot) {
    try {
      if (typeof _lsRemove === 'function') {
        _lsRemove('lineage_idle_save_' + slot);
        _lsRemove('lineage_idle_save_' + slot + '_bak');
      }
    } catch (e) {}
  }

  function _cloudPutBody(dataObj) {
    var wrap = { save: dataObj };
    if (typeof anticheatAuthExtras === 'function') {
      try { Object.assign(wrap, anticheatAuthExtras()); } catch (e) {}
    }
    return JSON.stringify(wrap);
  }

  function cloudPushSlot(slot, dataObj) {
    if (!cloudCanSync()) return;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    if (!dataObj || typeof dataObj !== 'object' || !dataObj.p) return;
    try {
      fetch(_base() + '/slot/' + slot, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: _cloudPutBody(dataObj),
      })
        .then(function (res) {
          if (res.status === 409) {
            return res.json().then(function (body) {
              if (body && (body.error === 'identity_conflict' || body.error === 'stale_save')) {
                cloudPullSlotIntoStorage(slot);
                if (body.error === 'identity_conflict') {
                  _notifyConflict('此存檔位雲端為不同角色，已改載入雲端版本。');
                }
              }
            });
          }
        })
        .catch(function () {});
    } catch (e) {}
  }

  function cloudPushSlotSync(slot, dataObj) {
    if (!cloudCanSync()) return false;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    if (!dataObj || typeof dataObj !== 'object' || !dataObj.p) return false;
    var r = _xhrJson('PUT', _base() + '/slot/' + slot, _cloudPutBody(dataObj), true);
    if (r && r.status === 409 && r.data && r.data.error === 'identity_conflict') {
      cloudPullSlotIntoStorage(slot);
      _notifyConflict('此存檔位雲端為不同角色，已改載入雲端版本。');
      return false;
    }
    if (r && r.status === 409 && r.data && r.data.error === 'stale_save') {
      cloudPullSlotIntoStorage(slot);
      return false;
    }
    return !!(r && r.ok);
  }

  /**
   * 將雲端槽位灌入本機：僅當雲端進度較佳／較新時覆寫；本機較佳則反推上雲。
   * 他帳殘留本機檔不會被雲端舊檔洗掉後再上傳到目前帳號。
   */
  function cloudPullSlotIntoStorage(slot) {
    if (!cloudCanSync()) return false;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    var r = _xhrJson('GET', _base() + '/slot/' + slot, null, true);
    var cloudData = r && r.ok && r.data && r.data.ok && r.data.data && r.data.data.p ? r.data.data : null;
    if (r && r.status === 404) cloudData = null;
    if (!cloudData && !(r && r.ok) && r && r.status !== 404) return false;

    var localData = _readSlotLocal(slot);
    if (localData && _isForeignAccountSave(localData)) {
      // 他帳殘留：有雲端就改用雲端，否則清掉避免顯示錯角
      if (cloudData) return _writeSlotLocal(slot, cloudData);
      _removeSlotLocal(slot);
      return !!cloudData;
    }

    if (!cloudData) {
      if (localData && localData.p && _localBelongsToCurrent(localData, true)) cloudPushSlotSync(slot, localData);
      return false;
    }
    if (!localData || !localData.p) return _writeSlotLocal(slot, cloudData);

    // 無 cloudOwner 的本機殘留 vs 雲端已有「不同」角色 → 以雲端為準
    if (!_ownerOf(localData) && cloudData && cloudData.p && !cloudSameCharacterIdentity(localData, cloudData)) {
      _backupConflictingLocal(slot, localData);
      _notifyConflict('存檔位 ' + slot + '：本機試玩角色與雲端不同，已載入雲端角色。');
      return _writeSlotLocal(slot, cloudData);
    }

    if (_preferCloudOnIdentityConflict(localData, cloudData)) {
      _backupConflictingLocal(slot, localData);
      _notifyConflict('存檔位 ' + slot + '：手機／電腦角色不同，已載入雲端版本（本機副本已備份）。');
      return _writeSlotLocal(slot, cloudData);
    }

    if (cloudSaveBeats(cloudData, localData)) {
      return _writeSlotLocal(slot, cloudData);
    }
    // 本機較佳／較新 → 保留本機並回填雲端（修「舊雲端覆蓋洗白」）
    cloudPushSlotSync(slot, localData);
    return false;
  }

  function cloudDeleteSlot(slot) {
    if (!cloudCanSync()) return;
    slot = Math.max(1, Math.min(8, parseInt(slot, 10) || 1));
    try {
      fetch(_base() + '/slot/' + slot, { method: 'DELETE' }).catch(function () {});
    } catch (e) {}
  }

  function cloudPushShared(name, dataObj) {
    if (!cloudCanSync() || !name) return;
    try {
      fetch(_base() + '/shared/' + encodeURIComponent(name), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataObj == null ? {} : dataObj),
      }).catch(function () {});
    } catch (e) {}
  }

  function _sharedWealth(obj) {
    if (!obj || typeof obj !== 'object') return -1;
    var gold = Math.max(0, Math.floor(Number(obj.gold) || 0));
    var items = Array.isArray(obj.items) ? obj.items : Array.isArray(obj) ? obj : [];
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      n += Math.max(1, Math.floor(Number(it && it.cnt) || 1));
    }
    return gold * 1000 + n;
  }

  function _writeSharedLocal(name, storageKey, obj) {
    if (typeof _lzSet !== 'function') return false;
    try {
      var payload = JSON.stringify(obj == null ? {} : obj);
      if (name.indexOf('pets') === 0 && typeof _saveWrap === 'function') payload = _saveWrap(payload);
      return !!_lzSet(storageKey, payload);
    } catch (e) {
      return false;
    }
  }

  function _mergeSharedPreferRicher(name, storageKey, cloudObj) {
    if (cloudObj == null) return false;
    var localRaw = typeof _lzGet === 'function' ? _lzGet(storageKey) : null;
    var localObj = null;
    if (localRaw != null && localRaw !== '') {
      try {
        localObj =
          name.indexOf('pets') === 0 ? _parseLzPayload(localRaw) || JSON.parse(localRaw) : JSON.parse(localRaw);
      } catch (e0) {
        localObj = null;
      }
    }
    if (localObj != null) {
      if (name.indexOf('warehouse') === 0) {
        if (_sharedWealth(localObj) > _sharedWealth(cloudObj)) {
          cloudPushShared(name, localObj);
          return false;
        }
      } else if (name.indexOf('pets') === 0) {
        var lc = Array.isArray(localObj) ? localObj.length : 0;
        var cc = Array.isArray(cloudObj) ? cloudObj.length : 0;
        if (lc > cc) {
          cloudPushShared(name, localObj);
          return false;
        }
      }
    }
    return _writeSharedLocal(name, storageKey, cloudObj);
  }

  function cloudPullSharedIntoStorage(name, storageKey) {
    if (!cloudCanSync() || !name || !storageKey) return false;
    var r = _xhrJson('GET', _base() + '/shared/' + encodeURIComponent(name), null, true);
    if (!r || r.status === 404) return false;
    if (!r.ok || !r.data || !r.data.ok) return false;
    return _mergeSharedPreferRicher(name, storageKey, r.data.data);
  }

  function cloudMirrorAfterSave(slot) {
    if (typeof window !== 'undefined' && (window.__onlineIdleForced || window.__wildOnlineForced)) return;
    if (!cloudCanSync()) return;
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
    if (!cloudCanSync()) return false;
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
          var slot = Math.max(1, Math.min(8, parseInt(k, 10) || 0));
          if (!slot) return;
          var localData = _readSlotLocal(slot);
          if (localData && _isForeignAccountSave(localData)) {
            if (_writeSlotLocal(slot, data)) any = true;
            return;
          }
          if (_preferCloudOnIdentityConflict(localData, data)) {
            _backupConflictingLocal(slot, localData);
            if (_writeSlotLocal(slot, data)) any = true;
            return;
          }
          if (!localData || !localData.p || cloudSaveBeats(data, localData)) {
            if (_writeSlotLocal(slot, data)) any = true;
          } else if (_localBelongsToCurrent(localData, true)) {
            cloudPushSlotSync(slot, localData);
          }
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
          if (_mergeSharedPreferRicher(name, map[name], bundle.shared[name])) any = true;
        });
      }
    } catch (e) {}
    return any;
  }

  function _isClosedPlayableCls(cls) {
    return cls === 'illusion' || cls === 'dragon' || cls === 'warrior';
  }

  function _purgeOneClosedSlot(slot, data) {
    if (!data || !data.p || !_isClosedPlayableCls(data.p.cls)) return false;
    try {
      if (typeof releaseCharNameId === 'function' && data.p.name) {
        releaseCharNameId(data.p.name, { slot: slot, enSeed: data.p.enSeed || '' });
      }
    } catch (e0) {}
    _removeSlotLocal(slot);
    if (!cloudCanSync()) return true;
    try {
      var r = _xhrJson('DELETE', _base() + '/slot/' + slot, null, true);
      return !!(r && r.ok);
    } catch (e1) {
      return false;
    }
  }

  function purgeClosedClassCloudSlots(bundleOpt) {
    var any = false;
    if (bundleOpt && bundleOpt.slots) {
      Object.keys(bundleOpt.slots).forEach(function (k) {
        var slot = Math.max(1, Math.min(8, parseInt(k, 10) || 0));
        if (!slot) return;
        if (_purgeOneClosedSlot(slot, bundleOpt.slots[k])) any = true;
      });
    } else if (cloudCanSync()) {
      var r = _xhrJson('GET', _base() + '/bundle', null, true);
      if (r && r.ok && r.data && r.data.ok && r.data.slots) {
        Object.keys(r.data.slots).forEach(function (k) {
          var slot = Math.max(1, Math.min(8, parseInt(k, 10) || 0));
          if (!slot) return;
          if (_purgeOneClosedSlot(slot, r.data.slots[k])) any = true;
        });
      }
    }
    for (var i = 1; i <= 8; i++) {
      var local = _readSlotLocal(i);
      if (local && local.p && _isClosedPlayableCls(local.p.cls)) {
        if (_purgeOneClosedSlot(i, local)) any = true;
      }
    }
    return any;
  }

  function _stripClosedSlotsFromBundle(bundle) {
    if (!bundle || !bundle.slots) return bundle;
    Object.keys(bundle.slots).forEach(function (k) {
      var d = bundle.slots[k];
      if (d && d.p && _isClosedPlayableCls(d.p.cls)) delete bundle.slots[k];
    });
    return bundle;
  }

  function cloudPullBundleSync() {
    if (!cloudCanSync()) return false;
    var r = _xhrJson('GET', _base() + '/bundle', null, true);
    if (!r || !r.ok || !r.data || !r.data.ok) return false;
    return cloudApplyBundle(r.data);
  }

  /** 登入／登出時清本機快取，避免 A 帳號存檔被 B 帳號看見或誤上傳 */
  function cloudClearLocalCache() {
    try {
      for (var i = 1; i <= 8; i++) {
        if (typeof _lsRemove === 'function') {
          _lsRemove('lineage_idle_save_' + i);
          _lsRemove('lineage_idle_save_' + i + '_bak');
        }
      }
      var wh = typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse';
      var pet = typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster';
      ['', '_classic'].forEach(function (suf) {
        if (typeof _lsRemove === 'function') {
          _lsRemove(wh + suf);
          _lsRemove(pet + suf);
        }
      });
    } catch (e) {}
  }

  function _bundleHasPlayableSlots(bundle) {
    if (!bundle || !bundle.slots) return false;
    var keys = Object.keys(bundle.slots);
    for (var i = 0; i < keys.length; i++) {
      var data = bundle.slots[keys[i]];
      if (data && typeof data === 'object' && data.p) return true;
    }
    return false;
  }

  /** 只上傳「屬於目前帳號」的本機槽位（避免登入空帳號時把他人進度種子化進雲端） */
  function cloudFlushLocalToCloud() {
    if (!cloudCanSync() || typeof _lzGet !== 'function') return false;
    var any = false;
    for (var i = 1; i <= 8; i++) {
      try {
        var data = _readSlotLocal(i);
        if (!data || !data.p) continue;
        if (!_localBelongsToCurrent(data)) continue;
        var r = _xhrJson('PUT', _base() + '/slot/' + i, JSON.stringify(data), true);
        if (r && r.ok) any = true;
      } catch (e) {}
    }
    ['warehouse', 'warehouse_classic', 'pets', 'pets_classic'].forEach(function (name) {
      try {
        var key =
          name.indexOf('warehouse') === 0
            ? (typeof WH_KEY !== 'undefined' ? WH_KEY : 'lineage_idle_warehouse') +
              (name.indexOf('classic') >= 0 ? '_classic' : '')
            : (typeof PET_ROSTER_KEY !== 'undefined' ? PET_ROSTER_KEY : 'fb5_pet_roster') +
              (name.indexOf('classic') >= 0 ? '_classic' : '');
        var raw = _lzGet(key);
        if (raw == null || raw === '') return;
        var obj =
          name.indexOf('pets') === 0 ? _parseLzPayload(raw) || JSON.parse(raw) : JSON.parse(raw);
        var r2 = _xhrJson(
          'PUT',
          _base() + '/shared/' + encodeURIComponent(name),
          JSON.stringify(obj == null ? {} : obj),
          true
        );
        if (r2 && r2.ok) any = true;
      } catch (e2) {}
    });
    return any;
  }

  /** 雲端全空時：把無 cloudOwner 的本機槽綁定目前帳號，才能回填（甲機救回）；已有他帳標記的不碰 */
  function _stampOwnerlessLocalAsCurrent() {
    var acc = String(currentAccount() || '').trim();
    if (!acc) return;
    for (var i = 1; i <= 8; i++) {
      try {
        var data = _readSlotLocal(i);
        if (!data || !data.p) continue;
        if (_ownerOf(data)) continue;
        data.p.cloudOwner = acc;
        data.cloudOwner = acc;
        _writeSlotLocal(i, data);
      } catch (e) {}
    }
  }

  // 雲端尚空時，把本機既有存檔上傳當種子（僅補 404；不覆蓋雲端既有；且僅本帳）
  function cloudBootstrapFromLocal() {
    if (!cloudCanSync()) return;
    _stampOwnerlessLocalAsCurrent();
    for (var i = 1; i <= 8; i++) {
      (function (slot) {
        try {
          fetch(_base() + '/slot/' + slot)
            .then(function (res) {
              if (res.status === 404 && typeof _lzGet === 'function') {
                var data = _readSlotLocal(slot);
                if (data && data.p && _localBelongsToCurrent(data)) cloudPushSlot(slot, data);
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

  /**
   * 登入／重整同步雲端。
   * ⚠️ 絕不可先清本機再灌雲端（舊雲端／部分槽位會把本機較新進度洗白）。
   * 改為逐槽合併：雲端較佳→寫本機；本機較佳→保留並回填雲端；他帳殘留→丟棄或改用本帳雲端。
   */
  function cloudSyncOnLogin() {
    return cloudReadyAsync(true).then(function (ready) {
      if (!ready || !cloudLoggedIn()) return false;
      _conflictNotified = false;
      return fetch(_base() + '/bundle', { cache: 'no-store' })
        .then(function (res) {
          return res.json().then(function (data) {
            for (var i = 1; i <= 8; i++) {
              var loc = _readSlotLocal(i);
              if (loc && loc.p && _isForeignAccountSave(loc)) _removeSlotLocal(i);
            }

            if (_bundleHasPlayableSlots(data)) {
              try { purgeClosedClassCloudSlots(data); } catch (ePurge) {}
              _stripClosedSlotsFromBundle(data);
              cloudApplyBundle(data);
              try { purgeClosedClassCharacterSlots({ silent: true }); } catch (ePurge2) {}
              for (var s = 1; s <= 8; s++) {
                var local = _readSlotLocal(s);
                var cloud = data.slots && data.slots[s];
                if (local && local.p && _localBelongsToCurrent(local) && !(cloud && cloud.p)) {
                  cloudPushSlotSync(s, local);
                }
              }
              return true;
            }
            try {
              _stampOwnerlessLocalAsCurrent();
              cloudFlushLocalToCloud();
            } catch (e) {
              try {
                cloudBootstrapFromLocal();
              } catch (e2) {}
            }
            return false;
          });
        })
        .catch(function () {
          return false;
        });
    });
  }

  function cloudSyncOnLoginWithTimeout(ms) {
    var limit = Math.max(3000, Number(ms) || 12000);
    return Promise.race([
      cloudSyncOnLogin(),
      new Promise(function (resolve) {
        setTimeout(function () { resolve(false); }, limit);
      }),
    ]);
  }

  window.cloudLoggedIn = cloudLoggedIn;
  window.cloudCanSync = cloudCanSync;
  window.cloudReady = cloudReady;
  window.cloudReadyAsync = cloudReadyAsync;
  window.cloudPushSlot = cloudPushSlot;
  window.cloudPullSlotIntoStorage = cloudPullSlotIntoStorage;
  window.cloudDeleteSlot = cloudDeleteSlot;
  window.cloudMirrorAfterSave = cloudMirrorAfterSave;
  window.cloudPullBeforeLoad = cloudPullBeforeLoad;
  window.cloudPullBundleSync = cloudPullBundleSync;
  window.cloudBootstrapFromLocal = cloudBootstrapFromLocal;
  window.cloudFlushLocalToCloud = cloudFlushLocalToCloud;
  window.cloudClearLocalCache = cloudClearLocalCache;
  window.cloudSyncOnLogin = cloudSyncOnLogin;
  window.cloudSyncOnLoginWithTimeout = cloudSyncOnLoginWithTimeout;
  window.purgeClosedClassCloudSlots = purgeClosedClassCloudSlots;
  window.cloudSaveProgressScore = cloudSaveProgressScore;
  window.cloudSaveBeats = cloudSaveBeats;

  try {
    var _kickCloudProbe = function () {
      if (_httpOk()) cloudReadyAsync(false);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _kickCloudProbe);
    else _kickCloudProbe();
  } catch (eBoot) {}
})();
