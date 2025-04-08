window.visibleCount = 100;
window.LOAD_STEP = 100;
window.isLoadingMore = false;
window.allLoaded = false;
window.slipResults = [];

async function loadSlipResults() {
  try {
    const res = await fetch("/api/slip-results");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("ไม่ใช่ array");

    data.sort((a, b) => new Date(b.createdAt || b.time) - new Date(a.createdAt || a.time));
    slipResults = data;
    renderSlipResults(0, visibleCount);
  } catch (err) {
    console.error("❌ โหลด slip ล้มเหลว:", err);
  }
}

function renderSlipResults(start, end) {
  const tbody = document.getElementById("slip-results-body");
  const loading = document.getElementById("loading-message");
  if (!tbody || !loading) return;

  const data = window.slipResults.slice(start, end); // ✅ ใช้ global
  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.time || "-"}</td>
      <td title="${r.shop || "-"}">${truncateText(r.shop || "-", 12)}</td>
      <td><img src="${r.image || 'https://placehold.co/40x40?text=No+Img'}" class="profile-img" /></td>
      <td title="${r.lineName || "-"}">${truncateText(r.lineName || "-", 12)}</td>
      <td class="${getStatusClass(r.status)}">${r.status || "-"}</td>
      <td>${r.amount || "-"}</td>
      <td>${r.response || "-"}</td>
      <td title="${r.ref || "-"}">${truncateEndText(r.ref || "-", 20)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (end >= slipResults.length) {
    allLoaded = true;
    loading.innerText = "";
  } else {
    loading.innerText = "";
  }
}
  

function getStatusClass(status) {
  switch (status) {
    case "สลิปถูกต้อง":
    case "สลิปซ้ำ ไม่เกิน 1 ชั่วโมง":
      return "status-success";

    case "สลิปซ้ำเดิม":
    case "บัญชีปลายทางผิด":
      return "status-fail";

    case "สลิปยอดเงินต่ำ":
    case "ใช้เวลาตรวจสอบนานเกินไป":
    case "พบสลิปต้องสงสัย ( อาจเป็นภาพสลิป แต่ไม่มี QRcode หรือ ปลอมสลิป )":
    case "เกิดข้อผิดพลาดระหว่างตรวจสอบ รอแอดมินตรวจสอบ":
    default:
      return "status-pending";
  }
}


function setupScrollListener() {
  const container = document.querySelector(".dashboard-table-wrapper");
  const loadingMsg = document.getElementById("loading-message");

  if (!container) {
    console.warn("⚠️ ไม่พบ dashboard-table-wrapper สำหรับ scroll");
    return;
  }

  console.log("✅ Scroll listener attached to", container);

  container.addEventListener("scroll", () => {
    if (
      !isLoadingMore &&
      !allLoaded &&
      container.scrollTop + container.clientHeight >= container.scrollHeight - 20
    ) {
      isLoadingMore = true;
      loadingMsg.innerText = "กำลังโหลดเพิ่มเติม...";
      setTimeout(() => {
        const previousCount = visibleCount;
        visibleCount += LOAD_STEP;
        renderSlipResults(previousCount, visibleCount);
        isLoadingMore = false;
      }, 500);
    }
  });
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + ".." : text;
}

function truncateEndText(text, maxLength) {
  return text.length > maxLength ? text.slice(-maxLength) : text;
}

// SSE สำหรับสลิปใหม่
function connectSSE() {
  if (window._sseConnected) return;
  console.log("🌐 Connecting SSE...");

  const eventSource = new EventSource("/events");

  eventSource.onopen = () => console.log("✅ SSE opened");
  eventSource.onerror = (e) => console.error("❌ SSE error", e);
  eventSource.onmessage = (event) => {
    try {
      const newSlip = JSON.parse(event.data);
      console.log("📩 New slip from SSE:", newSlip);
      window.slipResults = window.slipResults || [];
      window.slipResults.unshift(newSlip); // เพิ่มบนสุด
      const tbody = document.getElementById("slip-results-body");
      if (tbody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${newSlip.time || "-"}</td>
          <td title="${newSlip.shop || "-"}">${truncateText(newSlip.shop || "-", 12)}</td>
          <td><img src="${newSlip.image || '/images/no-image.png'}" class="profile-img" /></td>
          <td title="${newSlip.lineName || "-"}">${truncateText(newSlip.lineName || "-", 12)}</td>
          <td class="${getStatusClass(newSlip.status)}">${newSlip.status || "-"}</td>
          <td>${newSlip.amount || "-"}</td>
          <td>${newSlip.response || "-"}</td>
          <td title="${newSlip.ref || "-"}">${truncateEndText(newSlip.ref || "-", 20)}</td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
      }
    } catch (err) {
      console.error("❌ Error parsing SSE data", err);
    }
  };

  window._sseConnected = true;
}
  
  // เริ่มต้น dashboard
  function initDashboard() {
    loadSlipResults();
    setupScrollListener();
    connectSSE();
  }
  window.initDashboard = initDashboard;