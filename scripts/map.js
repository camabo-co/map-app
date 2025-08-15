// ✅ 完全対応済み map.js
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
  apiKey: "AIzaSyDdNI04D1xhQihN3DBDdF1_YAp6XRcErDw",
  authDomain: "maps3-986-ffbbd.firebaseapp.com",
  databaseURL: "https://maps3-986-ffbbd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "maps3-986-ffbbd",
  storageBucket: "maps3-986-ffbbd.appspot.com",
  messagingSenderId: "701191378459",
  appId: "1:701191378459:web:d2cf8d869f56c337b29995"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const coordRef = ref(db, "coordinates");

const map = L.map('map').setView([500, 500], 3);
L.tileLayer('', {
  attribution: '座標マップ'
}).addTo(map);

// グリッド表示
for (let i = 0; i <= 1000; i += 100) {
  L.polyline([[0, i], [1000, i]], { color: '#ccc', weight: 1 }).addTo(map);
  L.polyline([[i, 0], [i, 1000]], { color: '#ccc', weight: 1 }).addTo(map);
}

let allData = {};
const markers = {};

function getColor(level) {
  return {
    1: "blue",
    2: "green",
    3: "orange",
    4: "red",
    5: "purple",
    6: "brown",
    7: "black"
  }[level] || "gray";
}

function renderMarkers() {
  Object.values(markers).forEach(marker => map.removeLayer(marker));
  Object.entries(allData).forEach(([id, data]) => {
    if (data.取得状況 === "未取得") {
      const marker = L.circleMarker([data.Y, data.X], {
        radius: 8,
        color: getColor(data.レベル),
        fillOpacity: 0.8
      }).addTo(map);
      marker.bindPopup(`
        <b>${data.サーバー名}</b><br>
        X: ${data.X}, Y: ${data.Y}<br>
        Lv: ${data.レベル}<br>
        ${data.目印 || ""}<br><br>
        <button onclick="updateStatus('${id}', '取得済み')">✅ 取得済みにする</button><br>
        <button onclick="deleteCoordinate('${id}')">🗑 削除</button>
      `);
      markers[id] = marker;
    }
  });
}

get(coordRef).then(snapshot => {
  if (snapshot.exists()) {
    allData = snapshot.val();
    renderMarkers();
  }
});

window.registerCoordinate = () => {
  const サーバー名 = document.getElementById("server").value;
  const X = parseInt(document.getElementById("x").value);
  const Y = parseInt(document.getElementById("y").value);
  const レベル = parseInt(document.getElementById("level").value);
  const 目印 = document.getElementById("mark").value;
  if (!サーバー名 || isNaN(X) || isNaN(Y) || isNaN(レベル)) return alert("すべての必須項目を入力してください");

  const newCoord = { サーバー名, X, Y, レベル, 目印, 取得状況: "未取得" };
  push(coordRef, newCoord).then(() => location.reload());
};

window.updateStatus = (id, status) => {
  update(child(coordRef, id), { 取得状況: status }).then(() => location.reload());
};

window.deleteCoordinate = id => {
  if (confirm("この座標を削除しますか？")) {
    remove(child(coordRef, id)).then(() => location.reload());
  }
};

window.openListTab = status => {
  const list = Object.values(allData)
    .filter(d => d.取得状況 === status)
    .sort((a, b) => a.レベル - b.レベル || a.サーバー名.localeCompare(b.サーバー名) || a.X - b.X || a.Y - b.Y);

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${status}リスト</title></head><body><h2>${status}リスト</h2><ul>${list.map(d => `<li>Lv${d.レベル} ${d.サーバー名} (${d.X}, ${d.Y}) ${d.目印 || ""} <button onclick="window.opener.updateStatus('${Object.keys(allData).find(key => allData[key] === d)}','${status === "未取得" ? "取得済み" : "未取得"}')">⇄ 状態切替</button> <button onclick="window.opener.deleteCoordinate('${Object.keys(allData).find(key => allData[key] === d)}')">🗑 削除</button></li>`).join("")}</ul></body></html>`);
  win.document.close();
};

window.exportCSV = status => {
  const list = Object.values(allData).filter(d => d.取得状況 === status);
  const rows = ["サーバー名,X,Y,レベル,目印"];
  list.forEach(d => rows.push(`${d.サーバー名},${d.X},${d.Y},${d.レベル},${d.目印 || ""}`));
  const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${status}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

window.importCSV = () => {
  const input = document.getElementById("csvInput").value.trim();
  if (!input) return alert("CSVを入力してください");
  const lines = input.split("\n");
  lines.forEach(line => {
    const [サーバー名, x, y, level, 目印] = line.split(",");
    if (サーバー名 && x && y && level) {
      const newCoord = {
        サーバー名,
        X: parseInt(x),
        Y: parseInt(y),
        レベル: parseInt(level),
        目印: 目印 || "",
        取得状況: "未取得"
      };
      push(coordRef, newCoord);
    }
  });
  setTimeout(() => location.reload(), 1000);
};

document.getElementById("dedupeButton").onclick = () => {
  const seen = {};
  Object.entries(allData).forEach(([id, d]) => {
    const key = `${d.サーバー名}-${d.X}-${d.Y}`;
    if (seen[key]) remove(child(coordRef, id));
    else seen[key] = true;
  });
  setTimeout(() => location.reload(), 1000);
};
