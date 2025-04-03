// Global state for SSE connection
window._sseConnected = false;
window.slipResults = [];
window.visibleCount = 100;

// Utility functions
function escapeHTML(str) {
  const div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}

function showLoading(message = "กำลังโหลด...") {
  const content = document.getElementById("main-content");
  content.innerHTML = `<p style="text-align:center; font-size:18px; color:#555;">${message}</p>`;
}

// Page navigation
function loadPage(event, page) {
  if (event) event.preventDefault?.();

  // Clear active class
  const links = document.querySelectorAll(".sidebar li");
  links.forEach(link => link.classList.remove("active"));

  if (event?.target?.tagName === "LI") {
    event.target.classList.add("active");
  }

  showLoading();

  fetch(`/page/${page}`)
    .then(res => {
      if (!res.ok) throw new Error("ไม่สามารถโหลดหน้าได้");
      return res.text();
    })
    .then(html => {
      const container = document.getElementById("main-content");
      container.innerHTML = html;

      // Load scripts from innerHTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const scripts = tempDiv.querySelectorAll("script[src]");

      let loaded = 0;
      if (scripts.length === 0) finalize();

      scripts.forEach(tag => {
        const s = document.createElement("script");
        s.src = tag.src;
        s.onload = () => { loaded++; if (loaded === scripts.length) finalize(); };
        document.body.appendChild(s);
      });
    })
    .catch(err => {
      document.getElementById("main-content").innerHTML = 
        `<p style="color:red">เกิดข้อผิดพลาด: ${err.message}</p>`;
    });

  function finalize() {
    if (page === "main" && typeof loadShopsAndRender === "function") {
      loadShopsAndRender();
    }

    if (page === "dashboard" && typeof initDashboard === "function") {
      initDashboard();
      setupSSE();
    }
    if (page === "settings" && typeof loadSettings === "function") {
      console.log("✅ เรียก loadSettings() หลังโหลด settings.js แล้ว");
      loadSettings(); // 🟢 เรียกเอง ไม่รอ DOMContentLoaded
    }
  }
}

// SSE setup and handling
function setupSSE() {
  if (window._sseConnected) return;

  const sse = new EventSource("/events");
  
  sse.onopen = () => console.log("✅ SSE opened");
  sse.onerror = e => console.error("❌ SSE error", e);
  
  sse.onmessage = (e) => {
    try {
      const newSlip = JSON.parse(e.data);
      console.log("📩 New slip:", newSlip);
      
      window.slipResults = window.slipResults || [];
      window.slipResults.unshift(newSlip);
      
      const tbody = document.getElementById("slip-results-body");
      if (tbody) {
        tbody.innerHTML = "";
        renderSlipResults(0, window.visibleCount || 100);
      }
    } catch (err) {
      console.error("❌ Error parsing SSE:", err);
    }
  };

  window._sseConnected = true;
}

// Navigation helper
function navigateTo(e, p) { 
  loadPage(e, p); 
}

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => loadPage(null, "main"));

// Export functions for global use
window.navigateTo = navigateTo;
window.loadPage = loadPage;
window.escapeHTML = escapeHTML;
window.showLoading = showLoading;