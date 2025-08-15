import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getDatabase,
  ref,
  push,
  get,
  child,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIeAUT8GTZ27KYLMSAQxdcy3wC8xGmwcE",
  authDomain: "maps-server-2.firebaseapp.com",
  databaseURL: "https://maps-server-2-default-rtdb.asia-southeast1.firebasedatabase.app",  // ✅ ← これがURLです！
  projectId: "maps-server-2",
  storageBucket: "maps-server-2.firebasestorage.app",
  messagingSenderId: "583681392321",
  appId: "1:583681392321:web:63a5ee1e28752ce03ade40"
};


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ✅ 地図初期化（ズーム対応）
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 4,
  zoomSnap: 0.1,
  zoomDelta: 0.5
});

const bounds = [[0, 0], [1000, 1000]];
L.rectangle(bounds, { color: "#aaa", weight: 1 }).addTo(map);
map.fitBounds(bounds);
map.setView([500, 500], 0);

// ✅ グリッド描画
for (let i = 0; i <= 1000; i += 50) {
  L.polyline([[0, i], [1000, i]], { color: "#ccc", weight: 1 }).addTo(map);
  L.polyline([[i, 0], [i, 1000]], { color: "#ccc", weight: 1 }).addTo(map);
}

let markers = {};
let coordinatesData = {};

// ✅ マーカー読み込み
window.loadMarkers = async function () {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  const snap = await get(child(ref(db), "coordinates"));
  if (!snap.exists()) return;

  coordinatesData = snap.val();

  for (const key in coordinatesData) {
    const item = coordinatesData[key];
    if (item.取得状況 !== "未取得") continue;

    const marker = L.circleMarker([item.Y, item.X], {
      radius: 6,
      color: getMarkerColor(item.レベル),
      fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(`
      <b>サーバー名:</b> ${item.サーバー名}<br>
      <b>X:</b> ${item.X}<br>
      <b>Y:</b> ${item.Y}<br>
      <b>レベル:</b> ${item.レベル}<br>
      <b>目印:</b> ${item.目印 || ""}<br>
      <button onclick="setClaimed('${key}')">✅ 取得済みにする</button>
      <button onclick="deleteCoordinate('${key}')">🗑 削除</button>
    `);

    markers[key] = marker;
  }
};

function getMarkerColor(level) {
  const colors = {
    1: "blue", 2: "green", 3: "orange",
    4: "red", 5: "purple", 6: "brown", 7: "black"
  };
  return colors[level] || "gray";
}

// ✅ 削除
window.deleteCoordinate = async function (key) {
  if (!confirm("この座標を削除しますか？")) return;
  await remove(ref(db, `coordinates/${key}`));
  alert("削除しました");
  loadMarkers();
};

// ✅ 取得済みに変更
window.setClaimed = async function (key) {
  await update(ref(db, `coordinates/${key}`), { 取得状況: "取得済み" });
  alert("取得済みにしました");
  loadMarkers();
};

// ✅ 新規登録
document.getElementById("coordinateForm").addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {
    サーバー名: fd.get("サーバー名"),
    X: parseInt(fd.get("X")),
    Y: parseInt(fd.get("Y")),
    レベル: fd.get("レベル"),
    目印: fd.get("目印") || "",
    取得状況: "未取得"
  };
  await push(ref(db, "coordinates"), data);
  alert("登録しました");
  e.target.reset();
  loadMarkers();
});

// ✅ CSV一括登録
window.importCSV = async function () {
  const input = document.getElementById("csvInput").value.trim();
  if (!input) return alert("CSVを入力してください");

  const lines = input.split("\n");
  let count = 0;

  for (const line of lines) {
    const [サーバー名, X, Y, レベル, 目印 = ""] = line.split(",");
    if (!サーバー名 || !X || !Y || !レベル) continue;

    await push(ref(db, "coordinates"), {
      サーバー名,
      X: parseInt(X),
      Y: parseInt(Y),
      レベル,
      取得状況: "未取得",
      目印
    });
    count++;
  }

  alert(`${count} 件登録しました`);
  document.getElementById("csvInput").value = "";
  loadMarkers();
};

// ✅ 重複整理（サーバー名 + X + Y）
document.getElementById("dedupeButton").addEventListener("click", async () => {
  if (!confirm("重複を削除しますか？（最初の1件だけ残します）")) return;
  const snap = await get(child(ref(db), "coordinates"));
  if (!snap.exists()) return alert("データがありません");

  const all = snap.val();
  const seen = {};
  const toDelete = [];

  for (const key in all) {
    const item = all[key];
    const id = `${item.サーバー名}_${item.X}_${item.Y}`;
    if (seen[id]) {
      toDelete.push(key);
    } else {
      seen[id] = true;
    }
  }

  for (const key of toDelete) {
    await remove(ref(db, `coordinates/${key}`));
  }

  alert(`重複 ${toDelete.length} 件を削除しました`);
  loadMarkers();
});

// ✅ リスト表示（別タブ）
document.getElementById("toggleUnclaimed").addEventListener("click", () => openListTab("未取得"));
document.getElementById("toggleClaimed").addEventListener("click", () => openListTab("取得済み"));

function openListTab(status) {
  const win = window.open("", "_blank");
  const filtered = Object.entries(coordinatesData)
    .filter(([, v]) => v.取得状況 === status)
    .sort((a, b) => {
      const lvA = parseInt(a[1].レベル), lvB = parseInt(b[1].レベル);
      const svA = a[1].サーバー名, svB = b[1].サーバー名;
      if (lvA !== lvB) return lvA - lvB;
      if (svA !== svB) return svA.localeCompare(svB);
      return a[1].X - b[1].X || a[1].Y - b[1].Y;
    });

  const rows = filtered.map(([key, item]) => `
    <tr>
      <td>${item.レベル}</td>
      <td>${item.サーバー名}</td>
      <td>${item.X}</td>
      <td>${item.Y}</td>
      <td>${item.目印 || ""}</td>
      <td><button onclick="window.opener.deleteCoordinate('${key}')">🗑</button></td>
      ${status === "未取得" ? `<td><button onclick="window.opener.setClaimed('${key}')">✅</button></td>` : ""}
    </tr>
  `).join("");

  win.document.write(`
    <html><head><meta charset="UTF-8"><title>${status}リスト</title></head><body>
    <h2>${status}リスト</h2>
    <table border="1" cellspacing="0" cellpadding="5">
      <tr><th>Lv</th><th>サーバー</th><th>X</th><th>Y</th><th>目印</th><th>削除</th>${status === "未取得" ? "<th>取得</th>" : ""}</tr>
      ${rows}
    </table>
    </body></html>
  `);
}

// ✅ CSVエクスポート
function exportCSV(status) {
  const filtered = Object.values(coordinatesData).filter(i => i.取得状況 === status);
  const csv = filtered.map(i =>
    [i.サーバー名, i.X, i.Y, i.レベル, i.目印 || ""].join(",")
  );
  const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${status}_list.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("exportUnclaimedCSV").addEventListener("click", () => exportCSV("未取得"));
document.getElementById("exportClaimedCSV").addEventListener("click", () => exportCSV("取得済み"));

// ✅ 初回読み込み
loadMarkers();

