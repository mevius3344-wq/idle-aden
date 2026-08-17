window.Net = (() => {
  const listeners = {};
  let ws = null;
  let tries = 0;
  let timer = null;

  function on(type, fn) {
    (listeners[type] || (listeners[type] = [])).push(fn);
  }
  function emit(type, msg) {
    (listeners[type] || []).forEach((fn) => fn(msg));
  }
  function send(obj) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }
  function url() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/ws";
  }
  function connect() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    emit("status", { ok: false, text: "連線中…" });
    try { ws = new WebSocket(url()); }
    catch (e) {
      emit("status", { ok: false, text: "無法連線伺服器" });
      schedule();
      return;
    }
    ws.onopen = () => {
      tries = 0;
      emit("status", { ok: true, text: "已連線 · 即時版" });
      emit("open", {});
    };
    ws.onclose = () => {
      emit("status", { ok: false, text: "斷線，重連中…" });
      emit("close", {});
      schedule();
    };
    ws.onerror = () => {};
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      emit(msg.t || "msg", msg);
      emit("*", msg);
    };
  }
  function schedule() {
    clearTimeout(timer);
    tries += 1;
    timer = setTimeout(connect, Math.min(8000, 600 * tries));
  }
  return { on, send, connect, get ready() { return ws && ws.readyState === 1; } };
})();
