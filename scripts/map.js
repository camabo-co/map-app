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

//✅ Firebase 初期化（あなたの構成に対応済）
const firebaseConfig = {
  apiKey: "AIzaSyBIeAUT8GTZ27KYLMSAQxdcy3wC8xGmwcE",
  authDomain: "maps-server-2.firebaseapp.com",
  databaseURL: "https://maps-server-2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "maps-server-2",
  storageBucket: "maps-server-2.firebasestorage.app",
  messagingSenderId: "583681392321",
  appId: "1:583681392321:web:63a5ee1e28752ce03ade40"
};



const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ✅ Leafletマップ初期化
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 4,
  zoomSnap: 0.1,
  zoomDelta: 0.5
});

const bounds = [[0, 0], [1000, 1000]];
L.rectangle(bounds, { color: "#ccc", weight: 1 }).addTo(map);
map.fitBounds(bounds);
map.setView([500, 500], 0);

// グリッド線追加
for (let i = 0; i <= 1000; i += 50) {
  L.polyline([[0, i], [1000, i]], { color: "#ddd", weight: 1 }).addTo(map);
  L.polyline([[i, 0], [i, 1000]], { color: "#ddd", weight: 1 }).addTo(map);
}

let markers = {};
let coordinatesData = {};

window.loadMarkers = async function () {
  Object.values(markers).forEach(marker => map.removeLayer(marker));
  markers = {};

  const snap = await get(child(ref(db), "coordinates"));
  if (!snap.exists()) return;

  coordinatesData = snap.val();

  for (const key in coordinatesData) {
    const item = coordinatesData[key];
    if (item.取得状況 !== "未取得") continue;

    const color = getMarkerColor(item.レベル);
    const marker = L.circleMarker([item.Y, item.X], {
      radius: 6,
      color: color,
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
    1: "blue",
    2: "green",
    3: "orange",
    4: "red",
    5: "purple",
    6: "brown",
    7: "black"
  };
  return colors[level] || "gray";
}

// ✅ 取得済みにする
window.setClaimed = async function (key) {
  await update(ref(db, `coordinates/${key}`), { 取得状況: "取得済み" });
  alert("取得済みに変更しました");
  loadMarkers();
};

// ✅ 未取得に戻す
window.setUnclaimed = async function (key) {
  await update(ref(db, `coordinates/${key}`), { 取得状況: "未取得" });
  alert("未取得に戻しました");
  loadMarkers();
};

// ✅ 削除
window.deleteCoordinate = async function (key) {
  if (!confirm("この座標を削除しますか？")) return;
  await remove(ref(db, `coordinates/${key}`));
  alert("削除しました");
  loadMarkers();
};

// ✅ 一括登録（CSV）
document.getElementById("csvForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("csvInput").value.trim();
  const lines = text.split("\n");

  for (const line of lines) {
    const [サーバー名, X, Y, レベル, 目印 = ""] = line.split(",");
    if (!サーバー名 || !X || !Y || !レベル) continue;

    const duplicate = Object.values(coordinatesData).find(d =>
      d.X == X && d.Y == Y && d.サーバー名 == サーバー名
    );

    if (duplicate) {
      await update(ref(db, `coordinates/${duplicate.key}`), {
        取得状況: "未取得",
        レベル,
        目印
      });
    } else {
      await push(ref(db, "coordinates"), {
        サーバー名, X, Y, レベル, 目印, 取得状況: "未取得"
      });
    }
  }

  alert("一括登録が完了しました");
  document.getElementById("csvInput").value = "";
  loadMarkers();
});

// ✅ リストを開く（別タブ）
window.openListTab = function (status) {
  const filtered = Object.entries(coordinatesData)
    .filter(([_, d]) => d.取得状況 === status)
    .sort((a, b) => {
      const A = a[1], B = b[1];
      return A.レベル - B.レベル || A.サーバー名 - B.サーバー名 || A.X - B.X || A.Y - B.Y;
    });

  const win = window.open();
  win.document.write(`
    <html><head><meta charset="UTF-8"><title>${status}リスト</title>
    <style>
      body { font-family: sans-serif; padding: 20px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #999; padding: 4px; text-align: center; }
      button { font-size: 12px; padding: 4px 8px; }
    </style>
    </head><body>
    <h2>📋 ${status}リスト</h2>
    <table>
      <tr><th>Lv</th><th>サーバー</th><th>X</th><th>Y</th><th>目印</th><th>削除</th><th>${status === "未取得" ? "取得" : "未取得へ"}</th></tr>
      ${filtered.map(([key, d]) => `
        <tr>
          <td>${d.レベル}</td><td>${d.サーバー名}</td><td>${d.X}</td><td>${d.Y}</td><td>${d.目印 || ""}</td>
          <td><button onclick="window.opener.deleteCoordinate('${key}'); window.location.reload()">🗑</button></td>
          <td><button onclick="window.opener.${status === "未取得" ? "setClaimed" : "setUnclaimed"}('${key}'); window.location.reload()">✅</button></td>
        </tr>
      `).join("")}
    </table>
    </body></html>
  `);
};

// ✅ CSV出力
window.downloadCSV = function (status) {
  const rows = [["サーバー名", "X", "Y", "レベル", "目印"]];
  for (const d of Object.values(coordinatesData)) {
    if (d.取得状況 === status) {
      rows.push([d.サーバー名, d.X, d.Y, d.レベル, d.目印 || ""]);
    }
  }

  const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${status}_list.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ✅ 重複整理
window.cleanDuplicates = async function () {
  const all = Object.entries(coordinatesData);
  const seen = new Map();

  for (const [key, d] of all) {
    const id = `${d.サーバー名}_${d.X}_${d.Y}`;
    if (seen.has(id)) {
      await remove(ref(db, `coordinates/${key}`));
    } else {
      seen.set(id, key);
    }
  }

  alert("重複整理が完了しました");
  loadMarkers();
};

// 初回読み込み
loadMarkers();
