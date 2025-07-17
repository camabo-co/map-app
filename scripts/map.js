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

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -3,
  maxZoom: 2
}).setView([500, 500], -2);

for (let i = 0; i <= 1000; i++) {
  L.polyline([[i, 0], [i, 1000]], { color: "#ddd", weight: 0.3 }).addTo(map);
  L.polyline([[0, i], [1000, i]], { color: "#ddd", weight: 0.3 }).addTo(map);
}

const levelColors = {
  "1": "blue",
  "2": "lightblue",
  "3": "green",
  "4": "lime",
  "5": "orange",
  "6": "red",
  "7": "purple"
};

let unclaimedItems = [], claimedItems = [];
let claimedWin = null;
let unclaimedWin = null;

const form = document.getElementById("coordinateForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const serverName = formData.get("サーバー名");
  const x = parseInt(formData.get("X"));
  const y = parseInt(formData.get("Y"));
  const level = formData.get("レベル");

  if (!/^\d{3,4}$/.test(serverName)) {
    alert("サーバー名は3〜4桁の数字で入力してください");
    return;
  }
  if (isNaN(x) || x < 0 || x > 999 || isNaN(y) || y < 0 || y > 999) {
    alert("座標は0〜999の範囲で入力してください");
    return;
  }

  const snapshot = await get(child(ref(db), "coordinates"));
  const existingItems = snapshot.exists() ? snapshot.val() : {};
  for (const key in existingItems) {
    const item = existingItems[key];
    if (parseInt(item.X) === x && parseInt(item.Y) === y) {
      alert(`この座標 X:${x}, Y:${y} はすでに登録されています`);
      return;
    }
  }

  const data = {
    サーバー名: serverName,
    X: x,
    Y: y,
    レベル: level,
    取得状況: "未取得"
  };
  await push(ref(db, "coordinates"), data);
  alert("登録しました！");
  form.reset();
  await loadMarkers();
});

async function loadMarkers() {
  unclaimedItems = [];
  claimedItems = [];
  map.eachLayer(layer => {
    if (layer instanceof L.CircleMarker) map.removeLayer(layer);
  });

  const snapshot = await get(child(ref(db), "coordinates"));
  const items = snapshot.exists() ? snapshot.val() : {};
  for (const key in items) {
    const item = items[key];
    item._id = key;

    if (item.取得状況 === "未取得") {
      unclaimedItems.push(item);
      const marker = L.circleMarker([parseInt(item.Y), parseInt(item.X)], {
        radius: 1,
        color: levelColors[item.レベル] || "black",
        fillOpacity: 1
      }).addTo(map);

      marker.bindPopup(`
        <b>サーバー名:</b> ${item.サーバー名}<br>
        <b>Lv:</b> ${item.レベル}<br>
        <b>状態:</b> ${item.取得状況}<br>
        <button onclick="changeStatus('${item._id}')">取得済みにする</button><br>
        <button onclick="handleDelete('${item._id}', '削除しました！')">削除</button>
      `);
    } else {
      claimedItems.push(item);
    }
  }
}

window.changeStatus = async function(key) {
  await update(ref(db), { [`coordinates/${key}/取得状況`]: "取得済み" });
  alert("更新しました！");
  await loadMarkers();
  refreshListTabs();
};

window.handleStatusChange = async function(key, newStatus, message) {
  await update(ref(db), { [`coordinates/${key}/取得状況`]: newStatus });
  alert(message);
  await loadMarkers();
  refreshListTabs();
};

window.handleDelete = async function(key, message) {
  if (!confirm("本当に削除しますか？")) return;
  await remove(ref(db, `coordinates/${key}`));
  alert(message);
  await loadMarkers();
  refreshListTabs();
};

function refreshListTabs() {
  if (unclaimedWin && !unclaimedWin.closed) openListTab("未取得リスト", unclaimedItems, "unclaimed");
  if (claimedWin && !claimedWin.closed) openListTab("取得済みリスト", claimedItems, "claimed");
}

loadMarkers();

document.getElementById("toggleUnclaimed").addEventListener("click", () => {
  openListTab("未取得リスト", unclaimedItems, "unclaimed");
});

document.getElementById("toggleClaimed").addEventListener("click", () => {
  openListTab("取得済みリスト", claimedItems, "claimed");
});

function openListTab(title, items, type) {
  const win = window.open("", type === "unclaimed" ? "unclaimedWin" : "claimedWin");
  items.sort((a, b) => {
    const lv = parseInt(a.レベル) - parseInt(b.レベル);
    if (lv !== 0) return lv;
    const s = a.サーバー名.localeCompare(b.サーバー名, 'ja');
    if (s !== 0) return s;
    const x = parseInt(a.X) - parseInt(b.X);
    if (x !== 0) return x;
    return parseInt(a.Y) - parseInt(b.Y);
  });
  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: sans-serif; padding: 20px; background: #fafafa; }
        h2 { color: ${type === "unclaimed" ? "#6c63ff" : "darkgreen"}; }
        ul { list-style: none; padding: 0; }
        li {
          background: white; border: 1px solid #ccc; margin-bottom: 8px;
          padding: 10px; font-size: 14px;
        }
        button {
          margin-right: 8px; padding: 5px 10px; font-size: 13px;
          background: ${type === "unclaimed" ? "#6c63ff" : "darkorange"};
          color: white; border: none; border-radius: 4px;
          cursor: pointer;
        }
        button.delete { background: #d9534f; }
      </style>
    </head>
    <body>
      <h2>📋 ${title}</h2>
      <ul>
        ${items.map(item => `
          <li>
            サーバー名: ${item.サーバー名} / X:${item.X}, Y:${item.Y} / Lv${item.レベル}<br>
            ${type === "unclaimed"
              ? `<button onclick="window.opener.handleStatusChange('${item._id}', '取得済み', '更新しました')">取得済みに</button>`
              : `<button onclick="window.opener.handleStatusChange('${item._id}', '未取得', '未取得に戻しました')">未取得に戻す</button>`}
            <button class="delete" onclick="window.opener.handleDelete('${item._id}', '削除しました')">削除</button>
          </li>
        `).join("")}
      </ul>
    </body>
    </html>
  `;
  win.document.open();
  win.document.write(html);
  win.document.close();

  if (type === "unclaimed") unclaimedWin = win;
  else claimedWin = win;
}
