using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

class AdenServer
{
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
    static readonly object Gate = new object();
    static readonly ConcurrentDictionary<string, Session> Sessions = new ConcurrentDictionary<string, Session>();
    static Dictionary<string, object> World;
    static string Root;
    static string SavePath;
    static int Port = 5173;
    static DateTime LastSave = DateTime.UtcNow;

    class Session
    {
        public string Id = Guid.NewGuid().ToString("N");
        public WebSocket Ws;
        public string User;
        public string CharId;
        public readonly object SendLock = new object();
        public long LastSync;
    }

    static void Main(string[] args)
    {
        Root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
        SavePath = Path.Combine(Root, "data", "world.json");
        Directory.CreateDirectory(Path.GetDirectoryName(SavePath));
        LoadWorld();

        var listener = new HttpListener();
        var prefixes = new List<string> { "http://127.0.0.1:" + Port + "/", "http://localhost:" + Port + "/" };
        try
        {
            foreach (var a in Dns.GetHostEntry(Dns.GetHostName()).AddressList)
            {
                if (a.AddressFamily == AddressFamily.InterNetwork)
                    prefixes.Add("http://" + a + ":" + Port + "/");
            }
        }
        catch { }

        foreach (var p in prefixes.Distinct())
        {
            try { listener.Prefixes.Add(p); Console.WriteLine("bind " + p); }
            catch (Exception ex) { Console.WriteLine("skip " + p + " " + ex.Message); }
        }
        try { listener.Start(); }
        catch (Exception ex)
        {
            Console.WriteLine("無法啟動：" + ex.Message);
            return;
        }
        Console.WriteLine("雲州閒俠即時伺服器已啟動  瀏覽器開 http://127.0.0.1:" + Port);
        Task.Run((Action)Ticker);
        while (listener.IsListening)
        {
            HttpListenerContext ctx = null;
            try { ctx = listener.GetContext(); }
            catch { continue; }
            ThreadPool.QueueUserWorkItem(_ => Serve(ctx));
        }
    }

    static void Serve(HttpListenerContext ctx)
    {
        try
        {
            if (ctx.Request.IsWebSocketRequest)
            {
                HandleWs(ctx).Wait();
                return;
            }
            var path = ctx.Request.Url.LocalPath;
            if (path == "/" || path == "") path = "/index.html";
            if (path.Contains("..")) { ctx.Response.StatusCode = 400; ctx.Response.Close(); return; }
            var file = Path.Combine(Root, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(file)) { ctx.Response.StatusCode = 404; ctx.Response.Close(); return; }
            var ext = Path.GetExtension(file).ToLowerInvariant();
            string mime = "application/octet-stream";
            if (ext == ".html") mime = "text/html; charset=utf-8";
            else if (ext == ".css") mime = "text/css; charset=utf-8";
            else if (ext == ".js") mime = "text/javascript; charset=utf-8";
            else if (ext == ".png") mime = "image/png";
            else if (ext == ".json") mime = "application/json; charset=utf-8";
            var bytes = File.ReadAllBytes(file);
            ctx.Response.ContentType = mime;
            ctx.Response.ContentLength64 = bytes.Length;
            ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
            ctx.Response.Close();
        }
        catch
        {
            try { ctx.Response.Abort(); } catch { }
        }
    }

    static async Task HandleWs(HttpListenerContext ctx)
    {
        WebSocket ws = null;
        Session ses = null;
        try
        {
            var wsctx = await ctx.AcceptWebSocketAsync(null);
            ws = wsctx.WebSocket;
            ses = new Session { Ws = ws };
            Sessions[ses.Id] = ses;
            var buf = new byte[256 * 1024];
            while (ws.State == WebSocketState.Open)
            {
                using (var ms = new MemoryStream())
                {
                    WebSocketReceiveResult r;
                    do
                    {
                        r = await ws.ReceiveAsync(new ArraySegment<byte>(buf), CancellationToken.None);
                        if (r.MessageType == WebSocketMessageType.Close)
                        {
                            await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                            return;
                        }
                        ms.Write(buf, 0, r.Count);
                    } while (!r.EndOfMessage);
                    var text = Encoding.UTF8.GetString(ms.ToArray());
                    HandleMsg(ses, text);
                }
            }
        }
        catch { }
        finally
        {
            if (ses != null)
            {
                Session gone;
                Sessions.TryRemove(ses.Id, out gone);
                BroadcastWorld();
            }
            try { if (ws != null && ws.State == WebSocketState.Open) ws.Abort(); } catch { }
        }
    }

    static void HandleMsg(Session ses, string text)
    {
        Dictionary<string, object> msg;
        try { msg = (Dictionary<string, object>)Json.DeserializeObject(text); }
        catch { return; }
        var t = Str(msg, "t");
        lock (Gate)
        {
            switch (t)
            {
                case "register": Register(ses, msg, false); break;
                case "login": Register(ses, msg, true); break;
                case "create": CreateChar(ses, msg); break;
                case "enter": Enter(ses, msg); break;
                case "sync": Sync(ses, msg); break;
                case "chat": Chat(ses, msg); break;
                case "map": SetMap(ses, msg); break;
                case "marketList": MarketList(ses, msg); break;
                case "marketBuy": MarketBuy(ses, msg); break;
                case "partyCreate": PartyCreate(ses, msg); break;
                case "partyJoin": PartyJoin(ses, msg); break;
                case "bossHit": BossHit(ses, msg); break;
                case "announce": Announce(ses, msg); break;
                case "wh": Warehouse(ses, msg); break;
                case "logout": ses.CharId = null; ses.User = null; BroadcastWorld(); break;
            }
        }
    }

    static void Register(Session ses, Dictionary<string, object> msg, bool isLogin)
    {
        var user = Str(msg, "user").Trim();
        var pass = Hash(Str(msg, "pass"));
        if (user.Length < 2 || Str(msg, "pass").Length < 2)
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "帳號密碼至少 2 字" } });
            return;
        }
        var accounts = Dict(World, "accounts");
        if (!isLogin)
        {
            if (accounts.ContainsKey(user))
            {
                Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "此帳號已存在" } });
                return;
            }
            accounts[user] = new Dictionary<string, object> {
                { "user", user }, { "pass", pass }, { "chars", new ArrayList() },
                { "warehouse", new ArrayList() }, { "last", Now() }
            };
            SaveWorld();
        }
        if (!accounts.ContainsKey(user))
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "帳號或密碼錯誤" } });
            return;
        }
        var acc = (Dictionary<string, object>)accounts[user];
        if (Str(acc, "pass") != pass)
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "帳號或密碼錯誤" } });
            return;
        }
        ses.User = user;
        Send(ses, new Dictionary<string, object> { { "t", "login" }, { "account", PublicAccount(acc) } });
        SendWorld(ses);
    }

    static void CreateChar(Session ses, Dictionary<string, object> msg)
    {
        var acc = Acc(ses);
        if (acc == null) return;
        var chars = Arr(acc, "chars");
        if (chars.Count >= 3)
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "最多 3 名角色" } });
            return;
        }
        var ch = DictObj(msg, "char");
        if (ch == null) return;
        var name = Str(ch, "name");
        if (string.IsNullOrEmpty(name))
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "請輸入名稱" } });
            return;
        }
        if (NameTaken(name, null))
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "名稱已被使用" } });
            return;
        }
        ch["lastSync"] = Now();
        chars.Add(ch);
        SaveWorld();
        Send(ses, new Dictionary<string, object> { { "t", "account" }, { "account", PublicAccount(acc) } });
    }

    static void Enter(Session ses, Dictionary<string, object> msg)
    {
        var acc = Acc(ses);
        if (acc == null) return;
        var id = Str(msg, "id");
        var ch = FindChar(acc, id);
        if (ch == null) return;
        ses.CharId = id;
        var last = Long(ch, "lastSync");
        if (last == 0) last = Long(acc, "last");
        var offline = Math.Max(0, Now() - last);
        ch["lastSync"] = Now();
        Send(ses, new Dictionary<string, object> {
            { "t", "enter" }, { "char", ch }, { "offline", offline }, { "warehouse", Arr(acc, "warehouse") }
        });
        BroadcastWorld();
        BroadcastChat("sys", "系統", Str(ch, "name") + " 踏入了雲州。", "sys");
    }

    static void Sync(Session ses, Dictionary<string, object> msg)
    {
        var acc = Acc(ses);
        if (acc == null) return;
        var incoming = DictObj(msg, "char");
        if (incoming == null) return;
        var id = Str(incoming, "id");
        var chars = Arr(acc, "chars");
        for (int i = 0; i < chars.Count; i++)
        {
            var c = chars[i] as Dictionary<string, object>;
            if (c != null && Str(c, "id") == id)
            {
                incoming["lastSync"] = Now();
                chars[i] = incoming;
                acc["last"] = Now();
                ses.CharId = id;
                if (msg.ContainsKey("warehouse") && msg["warehouse"] is ArrayList)
                    acc["warehouse"] = msg["warehouse"];
                break;
            }
        }
        if ((DateTime.UtcNow - LastSave).TotalSeconds > 8) SaveWorld();
    }

    static void Chat(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        var text = Str(msg, "msg").Trim();
        var channel = Str(msg, "ch");
        if (text.Length == 0) return;
        if (text.Length > 80) text = text.Substring(0, 80);
        if (channel != "party") channel = "world";
        BroadcastChat(channel, Str(ch, "name"), text, channel);
    }

    static void SetMap(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        ch["mapId"] = Str(msg, "mapId");
        ch["hunting"] = Bool(msg, "hunting");
        BroadcastWorld();
    }

    static void MarketList(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        var it = DictObj(msg, "it");
        var price = Int(msg, "price");
        if (it == null || price < 1) return;
        var list = Arr(World, "market");
        var row = new Dictionary<string, object> {
            { "id", Guid.NewGuid().ToString("N").Substring(0, 10) },
            { "seller", Str(ch, "name") }, { "user", ses.User },
            { "it", it }, { "price", price }
        };
        list.Insert(0, row);
        if (list.Count > 80) list.RemoveAt(list.Count - 1);
        SaveWorld();
        Broadcast(new Dictionary<string, object> { { "t", "market" }, { "market", list } });
    }

    static void MarketBuy(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        var id = Str(msg, "id");
        var list = Arr(World, "market");
        Dictionary<string, object> row = null;
        int idx = -1;
        for (int i = 0; i < list.Count; i++)
        {
            var r = list[i] as Dictionary<string, object>;
            if (r != null && Str(r, "id") == id) { row = r; idx = i; break; }
        }
        if (row == null)
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "商品已下架" } });
            return;
        }
        var price = Int(row, "price");
        if (Int(ch, "gold") < price)
        {
            Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "金幣不足" } });
            return;
        }
        ch["gold"] = Int(ch, "gold") - price;
        list.RemoveAt(idx);
        var sellerUser = Str(row, "user");
        PaySeller(sellerUser, price);
        Send(ses, new Dictionary<string, object> {
            { "t", "bought" }, { "it", row["it"] }, { "gold", ch["gold"] }
        });
        SaveWorld();
        Broadcast(new Dictionary<string, object> { { "t", "market" }, { "market", list } });
        BroadcastChat("sys", "交易所", Str(ch, "name") + " 買下了商品。", "sys");
    }

    static void PaySeller(string user, int gold)
    {
        var accounts = Dict(World, "accounts");
        if (!accounts.ContainsKey(user)) return;
        var acc = (Dictionary<string, object>)accounts[user];
        var chars = Arr(acc, "chars");
        if (chars.Count == 0) return;
        var c = chars[0] as Dictionary<string, object>;
        if (c == null) return;
        c["gold"] = Int(c, "gold") + gold;
        foreach (var s in Sessions.Values)
        {
            if (s.User == user)
                Send(s, new Dictionary<string, object> { { "t", "goldAdd" }, { "gold", gold }, { "msg", "交易所售出 +" + gold } });
        }
    }

    static void PartyCreate(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        var list = Arr(World, "parties");
        var p = new Dictionary<string, object> {
            { "id", Guid.NewGuid().ToString("N").Substring(0, 8) },
            { "leader", Str(ch, "name") }, { "leaderId", Str(ch, "id") },
            { "map", Str(msg, "map") }, { "max", 5 }, { "auto", true },
            { "members", new ArrayList { Str(ch, "name") } }
        };
        list.Insert(0, p);
        if (list.Count > 30) list.RemoveAt(list.Count - 1);
        BroadcastWorld();
        Send(ses, new Dictionary<string, object> { { "t", "ok" }, { "msg", "隊伍已建立" } });
    }

    static void PartyJoin(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        var id = Str(msg, "id");
        foreach (var o in Arr(World, "parties"))
        {
            var p = o as Dictionary<string, object>;
            if (p == null || Str(p, "id") != id) continue;
            var members = Arr(p, "members");
            var max = Int(p, "max"); if (max <= 0) max = 5;
            if (members.Count >= max)
            {
                Send(ses, new Dictionary<string, object> { { "t", "err" }, { "msg", "隊伍已滿" } });
                return;
            }
            var name = Str(ch, "name");
            if (!members.Contains(name)) members.Add(name);
            BroadcastWorld();
            Send(ses, new Dictionary<string, object> { { "t", "ok" }, { "msg", "已加入 " + Str(p, "leader") + " 的隊伍" } });
            return;
        }
    }

    static void BossHit(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        var mapId = Str(msg, "mapId");
        var dmg = Int(msg, "dmg");
        if (dmg < 1) return;
        if (dmg > 800) dmg = 800;
        var bosses = Dict(World, "bosses");
        if (!bosses.ContainsKey(mapId)) return;
        var b = (Dictionary<string, object>)bosses[mapId];
        EnsureBoss(b, mapId);
        if (!Bool(b, "alive")) return;
        b["hp"] = Math.Max(0, Int(b, "hp") - dmg);
        var ranks = Dict(b, "ranks");
        var nm = Str(ch, "name");
        ranks[nm] = Int(ranks, nm) + dmg;
        if (Int(b, "hp") <= 0)
        {
            b["alive"] = false;
            b["next"] = Now() + Respawn(mapId) * 1000L;
            Broadcast(new Dictionary<string, object> { { "t", "mq" }, { "text", "⚔ 江湖霸主已被擊敗！" } });
            BroadcastChat("sys", "江湖霸主", Str(ch, "name") + " 參與擊殺了江湖霸主。", "sys");
            foreach (var s in Sessions.Values)
            {
                if (string.IsNullOrEmpty(s.CharId)) continue;
                Send(s, new Dictionary<string, object> {
                    { "t", "bossKill" }, { "mapId", mapId },
                    { "gold", 800 + new Random().Next(400) }, { "exp", 1200 }
                });
            }
        }
        Broadcast(new Dictionary<string, object> { { "t", "boss" }, { "bosses", bosses } });
    }

    static void Announce(Session ses, Dictionary<string, object> msg)
    {
        var ch = CurrentChar(ses);
        if (ch == null) return;
        var text = Str(msg, "text");
        if (text.Length == 0) return;
        Broadcast(new Dictionary<string, object> { { "t", "mq" }, { "text", text } });
    }

    static void Warehouse(Session ses, Dictionary<string, object> msg)
    {
        var acc = Acc(ses);
        var ch = CurrentChar(ses);
        if (acc == null || ch == null) return;
        Send(ses, new Dictionary<string, object> { { "t", "warehouse" }, { "warehouse", Arr(acc, "warehouse") } });
    }

    static void Ticker()
    {
        while (true)
        {
            Thread.Sleep(2000);
            lock (Gate)
            {
                var bosses = Dict(World, "bosses");
                foreach (var key in new[] { "wb1", "wb2", "wb3" })
                {
                    if (!bosses.ContainsKey(key)) continue;
                    var b = (Dictionary<string, object>)bosses[key];
                    EnsureBoss(b, key);
                    if (!Bool(b, "alive") && Now() >= Long(b, "next"))
                    {
                        b["alive"] = true;
                        b["hp"] = Int(b, "max");
                        b["ranks"] = new Dictionary<string, object>();
                        Broadcast(new Dictionary<string, object> { { "t", "mq" }, { "text", "江湖霸主已重生！" } });
                    }
                }
                BroadcastWorld();
                if ((DateTime.UtcNow - LastSave).TotalSeconds > 20) SaveWorld();
            }
        }
    }

    static void BroadcastWorld()
    {
        var maps = new Dictionary<string, object>();
        int online = 0, maxLv = 1;
        long tax = 0;
        var players = new ArrayList();
        foreach (var s in Sessions.Values)
        {
            if (string.IsNullOrEmpty(s.CharId) || s.User == null) continue;
            var acc = Acc(s);
            if (acc == null) continue;
            var ch = FindChar(acc, s.CharId);
            if (ch == null) continue;
            online++;
            var lv = Int(ch, "level");
            if (lv > maxLv) maxLv = lv;
            tax += Int(ch, "gold");
            var mid = Str(ch, "mapId");
            if (!string.IsNullOrEmpty(mid))
                maps[mid] = Int(maps, mid) + 1;
            players.Add(new Dictionary<string, object> {
                { "name", Str(ch, "name") }, { "lv", lv }, { "classId", Str(ch, "classId") },
                { "mapId", mid }, { "hunting", Bool(ch, "hunting") }
            });
        }
        World["tax"] = tax;
        Broadcast(new Dictionary<string, object> {
            { "t", "world" }, { "online", online }, { "maps", maps }, { "tax", tax },
            { "serverLv", maxLv }, { "parties", Arr(World, "parties") },
            { "market", Arr(World, "market") }, { "bosses", Dict(World, "bosses") },
            { "players", players }
        });
    }

    static void SendWorld(Session ses)
    {
        BroadcastWorld();
        Send(ses, new Dictionary<string, object> { { "t", "market" }, { "market", Arr(World, "market") } });
    }

    static void BroadcastChat(string ch, string name, string text, string cls)
    {
        Broadcast(new Dictionary<string, object> {
            { "t", "chat" }, { "ch", ch }, { "name", name }, { "msg", text }, { "cls", cls }, { "time", Now() }
        });
    }

    static void Broadcast(Dictionary<string, object> msg)
    {
        var json = Json.Serialize(msg);
        foreach (var s in Sessions.Values) Send(s, json);
    }

    static void Send(Session ses, Dictionary<string, object> msg)
    {
        Send(ses, Json.Serialize(msg));
    }

    static void Send(Session ses, string json)
    {
        try
        {
            if (ses.Ws == null || ses.Ws.State != WebSocketState.Open) return;
            var buf = Encoding.UTF8.GetBytes(json);
            lock (ses.SendLock)
            {
                ses.Ws.SendAsync(new ArraySegment<byte>(buf), WebSocketMessageType.Text, true, CancellationToken.None).Wait(2000);
            }
        }
        catch { }
    }

    static Dictionary<string, object> PublicAccount(Dictionary<string, object> acc)
    {
        return new Dictionary<string, object> {
            { "user", Str(acc, "user") }, { "chars", Arr(acc, "chars") }, { "warehouse", Arr(acc, "warehouse") }
        };
    }

    static Dictionary<string, object> Acc(Session ses)
    {
        if (ses.User == null) return null;
        var accounts = Dict(World, "accounts");
        if (!accounts.ContainsKey(ses.User)) return null;
        return (Dictionary<string, object>)accounts[ses.User];
    }

    static Dictionary<string, object> CurrentChar(Session ses)
    {
        var acc = Acc(ses);
        if (acc == null || ses.CharId == null) return null;
        return FindChar(acc, ses.CharId);
    }

    static Dictionary<string, object> FindChar(Dictionary<string, object> acc, string id)
    {
        foreach (var o in Arr(acc, "chars"))
        {
            var c = o as Dictionary<string, object>;
            if (c != null && Str(c, "id") == id) return c;
        }
        return null;
    }

    static bool NameTaken(string name, string exceptId)
    {
        foreach (var kv in Dict(World, "accounts"))
        {
            var acc = kv.Value as Dictionary<string, object>;
            if (acc == null) continue;
            foreach (var o in Arr(acc, "chars"))
            {
                var c = o as Dictionary<string, object>;
                if (c == null) continue;
                if (Str(c, "name") == name && Str(c, "id") != exceptId) return true;
            }
        }
        return false;
    }

    static void EnsureBoss(Dictionary<string, object> b, string id)
    {
        if (!b.ContainsKey("max")) b["max"] = id == "wb3" ? 200000 : id == "wb2" ? 80000 : 25000;
        if (!b.ContainsKey("hp")) b["hp"] = b["max"];
        if (!b.ContainsKey("alive")) b["alive"] = true;
        if (!b.ContainsKey("next")) b["next"] = 0L;
        if (!b.ContainsKey("ranks")) b["ranks"] = new Dictionary<string, object>();
    }

    static int Respawn(string id)
    {
        if (id == "wb3") return 480;
        if (id == "wb2") return 300;
        return 180;
    }

    static void LoadWorld()
    {
        if (File.Exists(SavePath))
        {
            try
            {
                World = (Dictionary<string, object>)Json.DeserializeObject(File.ReadAllText(SavePath, Encoding.UTF8));
            }
            catch { World = null; }
        }
        if (World == null) World = new Dictionary<string, object>();
        if (!World.ContainsKey("accounts")) World["accounts"] = new Dictionary<string, object>();
        if (!World.ContainsKey("market")) World["market"] = new ArrayList();
        if (!World.ContainsKey("parties")) World["parties"] = new ArrayList();
        if (!World.ContainsKey("bosses")) World["bosses"] = new Dictionary<string, object>();
        var bosses = Dict(World, "bosses");
        foreach (var id in new[] { "wb1", "wb2", "wb3" })
        {
            if (!bosses.ContainsKey(id)) bosses[id] = new Dictionary<string, object>();
            EnsureBoss((Dictionary<string, object>)bosses[id], id);
        }
    }

    static void SaveWorld()
    {
        try
        {
            File.WriteAllText(SavePath, Json.Serialize(World), Encoding.UTF8);
            LastSave = DateTime.UtcNow;
        }
        catch (Exception ex) { Console.WriteLine("save fail " + ex.Message); }
    }

    static string Hash(string s)
    {
        using (var sha = SHA256.Create())
        {
            var h = sha.ComputeHash(Encoding.UTF8.GetBytes("aden|" + s));
            var sb = new StringBuilder();
            foreach (var b in h) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }

    static long Now()
    {
        return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
    }

    static string Str(Dictionary<string, object> d, string k)
    {
        if (d == null || !d.ContainsKey(k) || d[k] == null) return "";
        return Convert.ToString(d[k]);
    }
    static int Int(Dictionary<string, object> d, string k)
    {
        if (d == null || !d.ContainsKey(k) || d[k] == null) return 0;
        try { return Convert.ToInt32(d[k]); } catch { return 0; }
    }
    static long Long(Dictionary<string, object> d, string k)
    {
        if (d == null || !d.ContainsKey(k) || d[k] == null) return 0;
        try { return Convert.ToInt64(d[k]); } catch { return 0; }
    }
    static bool Bool(Dictionary<string, object> d, string k)
    {
        if (d == null || !d.ContainsKey(k) || d[k] == null) return false;
        if (d[k] is bool) return (bool)d[k];
        return Str(d, k) == "True" || Str(d, k) == "true";
    }
    static Dictionary<string, object> Dict(Dictionary<string, object> d, string k)
    {
        if (d == null || !d.ContainsKey(k) || d[k] == null)
        {
            var n = new Dictionary<string, object>();
            if (d != null) d[k] = n;
            return n;
        }
        if (d[k] is Dictionary<string, object>) return (Dictionary<string, object>)d[k];
        var empty = new Dictionary<string, object>();
        d[k] = empty;
        return empty;
    }
    static Dictionary<string, object> DictObj(Dictionary<string, object> d, string k)
    {
        if (d == null || !d.ContainsKey(k)) return null;
        return d[k] as Dictionary<string, object>;
    }
    static ArrayList Arr(Dictionary<string, object> d, string k)
    {
        if (d == null) return new ArrayList();
        if (!d.ContainsKey(k) || d[k] == null) { d[k] = new ArrayList(); return (ArrayList)d[k]; }
        if (d[k] is ArrayList) return (ArrayList)d[k];
        var a = new ArrayList();
        d[k] = a;
        return a;
    }
}
