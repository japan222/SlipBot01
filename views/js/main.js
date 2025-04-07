// Global state
window.shopData = [];
window.currentShopPrefix = "";
window.currentEditingPrefix = "";
window.currentEditingIndex = 0;


// โหลดข้อมูลร้านค้าทั้งหมดเมื่อหน้าเว็บโหลด
async function loadShops() {
    try {
        const response = await fetch("/api/shops");
        const data = await response.json();
        shopData = data.shops || [];
    } catch (error) {
        console.error("❌ โหลดข้อมูลร้านค้าไม่สำเร็จ:", error);
    }
}

function openShopLinesModal(prefix) {
    currentShopPrefix = prefix; // ✅ ตั้งค่า prefix ให้ถูกต้อง
    const modal = document.getElementById("shopLinesModal");
    const lineListElement = document.getElementById("line-list");
    const modalTitle = document.getElementById("modal-shop-title"); // ดึง h2

    // ค้นหาร้านค้าที่มี prefix ตรงกัน
    const shop = shopData.find(s => s.prefix === prefix);

    if (!shop) return;

    // **เติมชื่อร้านลงใน Modal**
    modalTitle.innerHTML = `
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/LINE_logo.svg/120px-LINE_logo.svg.png" id="line-logo"/>
            รายการ LINE ร้าน ${shop.name}
        `;

    // แสดงบัญชี LINE
    if (!shop.lines || shop.lines.length === 0) {
        lineListElement.innerHTML = "<p>ไม่มีบัญชี LINE</p>";
    } else {
        let html = "";
        shop.lines.forEach((line, index) => {
            html += `
                    <div class="shop-line-item">
                        <span>${line.linename}</span>
                        <div>
                            <button class="line-btn-edit" onclick="editLine('${prefix}', ${index})">แก้ไข</button>
                            <button class="line-btn-delete" onclick="deleteLine('${prefix}', ${index})">ลบ</button>
                        </div>
                    </div>
                `;
        });
        lineListElement.innerHTML = html;
    }

    modal.style.display = "flex";
}

function closeEditBankModal() {
    document.getElementById("editbankModal").style.display = "none";
}

// ปิด Modal
function closeShopLinesModal() {
    document.getElementById("shopLinesModal").style.display = "none";
}


// เปิด Modal เพิ่มบัญชี LINE
function addNewLine() {
    document.getElementById("addLineModal").style.display = "flex";

    // ดึงชื่อร้านที่เกี่ยวข้องมาแสดง
    const shop = shopData.find(s => s.prefix === currentShopPrefix);
    if (shop) {
        document.getElementById("shopNameTitle").innerText = shop.name.toUpperCase();
    }
}

// ปิด Modal เพิ่มบัญชี LINE
function closeAddLineModal() {
    document.getElementById("addLineModal").style.display = "none";
}

function showAlertMessage(message, elementId = "alertMessageAddline", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }

    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
    }, 3000);
}

// บันทึกบัญชี LINE ใหม่
async function saveNewLine() {
    const newLineName = document.getElementById("newLineName").value.trim();
    const newAccessToken = document.getElementById("newAccessToken").value.trim();
    const newSecretToken = document.getElementById("newSecretToken").value.trim();

    if (!newLineName || !newAccessToken || !newSecretToken) {
        showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageAddline", false);
        return;
    }

    // ✅ ตรวจสอบ Access Token ก่อนเพิ่มบัญชี LINE
    const response = await fetch("/api/validate-access-token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: newAccessToken }),
    });

    const result = await response.json();

    if (!result.valid) {
        showAlertMessage(`${result.message}`, "alertMessageAddline", false);
        return;
    }

    // ถ้า Access Token ถูกต้อง
    const shop = shopData.find(s => s.prefix === currentShopPrefix);
    if (!shop) return;

    shop.lines.push({
        linename: newLineName,
        access_token: newAccessToken,
        secret_token: newSecretToken,
    });

    // ส่งข้อมูลไปยัง API
    const apiResponse = await fetch("/api/add-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prefix: currentShopPrefix,
            linename: newLineName,
            access_token: newAccessToken,
            secret_token: newSecretToken
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.success) {
        alert("เพิ่มบัญชี LINE สำเร็จ!");
        closeAddLineModal();
        loadShopLines(currentShopPrefix); // โหลดรายการใหม่
    } else {
        showAlertMessage("เกิดข้อผิดพลาด: " + apiResult.message, "alertMessageAddline", false);
    }
}

function loadShopLines(prefix) {
    console.log(`🔄 กำลังโหลดบัญชี LINE สำหรับร้าน: ${prefix}`);

    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop) {
        console.error("❌ ไม่พบร้านค้าใน shopData!", shopData);
        return;
    }

    const lineListElement = document.getElementById("line-list");

    if (!shop.lines || shop.lines.length === 0) {
        lineListElement.innerHTML = "<p>ไม่มีบัญชีไลน์</p>";
        return;
    }

    let html = "";
    shop.lines.forEach((line, index) => {
        html += `
            <div class="shop-line-item">
                <span>${line.linename}</span>
                <div>
                    <button class="line-btn-edit" onclick="editLine('${prefix}', ${index})">แก้ไข</button>
                    <button class="line-btn-delete" onclick="deleteLine('${prefix}', ${index})">ลบ</button>
                </div>
            </div>
        `;
    });

    lineListElement.innerHTML = html;
    console.log("✅ โหลดบัญชี LINE สำเร็จ:", shop.lines);
}

async function deleteLine(prefix, index) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบบัญชีไลน์นี้?")) return;

    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop) return;

    shop.lines.splice(index, 1); // ลบบัญชี LINE ออกจาก array

    // ส่งคำขอลบไปยัง API
    const response = await fetch("/api/delete-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, index })
    });

    const result = await response.json();
    if (result.success) {
        alert("ลบบัญชีไลน์สำเร็จ!");
        loadShopLines(prefix); // โหลดรายการใหม่
    } else {
        alert("เกิดข้อผิดพลาด: " + result.message);
    }
}

function editLine(prefix, index) {

    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop) {
        console.error("❌ ไม่พบร้านค้า!");
        return;
    }

    const line = shop.lines[index];
    if (!line) {
        console.error("❌ ไม่พบบัญชี LINE!");
        return;
    }


    // ✅ ตั้งค่า prefix และ index ก่อนเปิด Modal
    currentEditingPrefix = prefix;
    currentEditingIndex = index;

    document.getElementById("editLinename").value = line.linename;
    document.getElementById("editAccessToken").value = line.access_token;
    document.getElementById("editSecretToken").value = line.secret_token;

    document.getElementById("editLineModal").style.display = "flex";
}


function closeEditLineModal() {
    document.getElementById("editLineModal").style.display = "none";
}


// ฟังก์ชันบันทึกการแก้ไข
async function saveEditedLine() {
    const newName = document.getElementById("editLinename").value.trim();
    const newAccessToken = document.getElementById("editAccessToken").value.trim();
    const newSecretToken = document.getElementById("editSecretToken").value.trim();

    console.log("📌 Debug: ค่าที่กำลังส่งไป API:", {
        prefix: currentEditingPrefix,  // <--- ต้องมีค่า!
        index: currentEditingIndex,
        linename: newName,
        access_token: newAccessToken,
        secret_token: newSecretToken
    });

    if (!currentEditingPrefix || currentEditingPrefix.trim() === "") {
        console.log("❌ เกิดข้อผิดพลาด: ไม่พบค่า Prefix ของร้านค้า");
        return;
    }

    if (!newName || !newAccessToken || !newSecretToken) {
        showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageEditLine", false);
        return;
    }

    // ✅ ตรวจสอบ Access Token ก่อนเพิ่มบัญชี LINE
    const response = await fetch("/api/validate-access-token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: newAccessToken }),
    });

    const result = await response.json();

    if (!result.valid) {
        showAlertMessage(`${result.message}`, "alertMessageEditLine", false);
        return;
    }


    const apiResponse = await fetch("/api/update-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prefix: currentEditingPrefix,
            index: currentEditingIndex,
            linename: newName,
            access_token: newAccessToken,
            secret_token: newSecretToken
        })
    });


    const apiResult = await apiResponse.json();  // ใช้ผลลัพธ์จากการอัปเดตข้อมูล
    console.log("📡 API Response:", apiResult);

    if (apiResult.success) {
        alert("✅ แก้ไขบัญชีไลน์สำเร็จ!");

        // ✅ อัปเดตข้อมูลใน shopData ทันที
        const shop = shopData.find(s => s.prefix === currentEditingPrefix);
        if (shop) {
            shop.lines[currentEditingIndex].linename = newName;
            shop.lines[currentEditingIndex].access_token = newAccessToken;
            shop.lines[currentEditingIndex].secret_token = newSecretToken;
        }

        // ✅ อัปเดต UI โดยตรง
        updateShopLinesUI(currentEditingPrefix);

        // ✅ ปิด Modal ถ้าต้องการ
        closeEditLineModal();

    } else {
        showAlertMessage(`เกิดข้อผิดพลาดในการแก้ไข โปรดลองอีกครั้ง!`, "alertMessageEditLine", false);
    }
}

function showAlertMessage(message, elementId = "alertMessageEditLine", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }

    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
        console.log(`⏳ ซ่อนข้อความแจ้งเตือนที่ ${elementId}`);
    }, 3000);
}


function updateShopLinesUI(prefix) {
    const shop = shopData.find(s => s.prefix === prefix);
    const lineListElement = document.getElementById("line-list");

    if (!shop || !shop.lines || shop.lines.length === 0) {
        lineListElement.innerHTML = "<p>ไม่มีบัญชีไลน์</p>";
        return;
    }

    let html = "";
    shop.lines.forEach((line, index) => {
        html += `
            <div class="shop-line-item">
                <span>${line.linename}</span>
                <div>
                    <button class="line-btn-edit" onclick="editLine('${prefix}', ${index})">แก้ไข</button>
                    <button class="line-btn-delete" onclick="deleteLine('${prefix}', ${index})">ลบ</button>
                </div>
            </div>
        `;
    });

    lineListElement.innerHTML = html;
}

window.addEventListener("DOMContentLoaded", loadShops);

function openShopInfoModal(shop) {
    document.getElementById("shopInfoTitle").textContent = `ข้อมูลร้าน: ${shop.name || "ไม่ระบุชื่อ"}`;
    document.getElementById("shopInfoModal").style.display = "flex";

    const linesHTML = (shop.lines && shop.lines.length > 0)
        ? `
        <p class="top-list"><strong>ไลน์สำหรับร้านนี้</strong></p>
        <ul class="line-list-ul">
          ${shop.lines.map((line, index) => `
            <li>
            <strong>${line.linename}</strong><br>
            <span class="webhook-path">
                <span class="no-select-arrow"><strong> Webhook ➡️ </strong></span>https://slipchecker.onrender.com/webhook/${shop.prefix}/line${index + 1}.bot
            </span>
            </li>
          `).join("")}
        </ul>`
        : `<p class="no-line">❌ ไม่มีบัญชี LINE ที่เพิ่มไว้</p>`;

    document.getElementById("shopInfoBody").innerHTML = `
      <p><strong>Prefix:</strong> ${shop.prefix}</p>
      ${linesHTML}
    `;
}

function closeShopInfoModal() {
    document.getElementById("shopInfoModal").style.display = "none";
}

// ฟังก์ชันเปิด Modal แก้ไขร้านค้า
function openEditShopModal(name, prefix) {
    document.getElementById("editShopName").value = name;
    document.getElementById("editShopPrefix").value = prefix;
    currentEditingPrefix = prefix;
    document.getElementById("editShopModal").style.display = "flex";
}

// ฟังก์ชันปิด Modal
function closeEditShopModal() {
    document.getElementById("editShopModal").style.display = "none";
}

// เปิด Modal
function openAddShopModal() {
    document.getElementById("addShopModal").style.display = "flex";
}

// ปิด Modal
function closeAddShopModal() {
    document.getElementById("addShopModal").style.display = "none";
}


// ฟังก์ชันบันทึกการแก้ไขร้านค้า
async function saveShopChanges() {
    const newName = document.getElementById("editShopName").value.trim();

    if (!newName) {
        showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageEditShop", false);
        return;
    }

    const response = await fetch("/api/update-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: currentEditingPrefix, name: newName })
    });

    const result = await response.json();
    if (result.success) {
        alert("แก้ไขร้านค้าสำเร็จ!");
        window.location.reload(); // รีเฟรชหน้า
    } else {
        alert("เกิดข้อผิดพลาด: " + result.message, "alertMessageEditShop", false);
    }
}

function showAlertMessage(message, elementId = "alertMessageEditShop", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }
    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
        console.log(`⏳ ซ่อนข้อความแจ้งเตือนที่ ${elementId}`);
    }, 3000);
}

// ✅ ฟังก์ชันหลัก โหลดร้านค้า + render
async function loadShopsAndRender() {
    try {
        const response = await fetch("/api/shops");
        const data = await response.json();
        shopData = data.shops || [];

        const shopListElement = document.getElementById("shop-list");
        if (!shopData.length) {
            shopListElement.innerHTML = '<div class="no-shop">ยังไม่มีข้อมูลร้านค้า</div>';
            return;
        }

        let html = "";
        shopData.forEach(shop => {
            const slipCheckOption = shop.slipCheckOption || "duplicate";

            html += `
          <div class="main-page shop-item">
            <div class="shop-info ${shop.status ? "active" : "inactive"}">
              <span class="status-dot"></span>
              <span class="shop-name">${shop.name}</span>
            </div>
            <div class="slip-check-option">
              <select onchange="updateSlipCheckOption('${shop.prefix}', this.value)">
                <option value="duplicate" ${slipCheckOption === "duplicate" ? "selected" : ""}>ตรวจเฉพาะสลิปซ้ำ</option>
                <option value="all" ${slipCheckOption === "all" ? "selected" : ""}>ตรวจสลิปทุกแบบ</option>
              </select>
            </div>
            <div class="buttons">
              <label class="switch">
                <input type="checkbox" ${shop.status ? "checked" : ""} onchange="handleToggle('${shop.prefix}', this)">
                <span class="slider"></span>
              </label>
              <button class="btn btn-line" onclick="openShopLinesModal('${shop.prefix}')">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/LINE_logo.svg/120px-LINE_logo.svg.png" class="btn-logo" alt="LINE Logo"/>
                    ไลน์ร้าน
              </button>
              <button class="btn btn-bank" onclick="openBankModal('${shop.prefix}')">จัดการบัญชีธนาคาร</button>
              <button class="btn btn-info btn-shop-info" data-prefix="${shop.prefix}">ข้อมูลร้านค้า</button>
              <button class="btn btn-edit" onclick="openEditShopModal('${shop.name}', '${shop.prefix}')">แก้ไข</button>
              <button class="btn btn-delete" onclick="deleteShop('${shop.prefix}')">ลบร้านค้า</button>
            </div>
          </div>
        `;
        });

        shopListElement.innerHTML = html;
        document.querySelectorAll(".btn-shop-info").forEach(btn => {
            btn.addEventListener("click", () => {
                const prefix = btn.getAttribute("data-prefix");
                const shop = shopData.find(s => s.prefix === prefix);
                if (shop) openShopInfoModal(shop);
            });
        });
    } catch (err) {
        console.error("❌ โหลดข้อมูลร้านค้าไม่สำเร็จ:", err);
    }
}

// ✅ Event เริ่มต้น
(async () => {
    console.log("✅ main.js loaded and executing immediately");
    await loadShopsAndRender();
    await fetchAndRenderQuota();
})();

// ✅ ดึงข้อมูลโควต้า
async function fetchAndRenderQuota() {
    try {
        const res = await fetch("/api/quota");
        const data = await res.json();
        const el = document.querySelector(".quota");
        if (!el) {
            console.warn("⚠️ ไม่พบ .quota element ใน DOM");
            return;
        }

        if (data.quota === 0) {
            el.textContent = `โควต้าที่เหลือ: -${Math.round(data.overQuota || 0)}`;
            el.style.color = "#dc3545";
        } else {
            el.textContent = `โควต้าที่เหลือ: ${data.quota}`;
            el.style.color = "#111111";
        }
    } catch {
        document.querySelector(".quota").textContent = "โค้วต้าที่เหลือ: ไม่ทราบ";
    }
}

function openBankModal(prefix) {
    let modal = document.getElementById("bankModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "bankModal";
        modal.className = "modal";
        document.body.appendChild(modal);
    }

    modal.style.display = "flex";  // เปิด Modal

    fetch("/api/bank-accounts")
        .then((res) => res.json())
        .then((data) => {
            const accounts = data.accounts[prefix] || [];
            const listContainer = document.getElementById("bank-list");
            const bankTitle = document.getElementById("BankTitle");

            listContainer.innerHTML = "";
            const shop = shopData.find(s => s.prefix === prefix);
            if (shop) {
                shop.bankAccounts = accounts; // ✅ บรรทัดนี้คือหัวใจของปัญหา
                bankTitle.textContent = `รายการบัญชีธนาคารร้าน: ${shop.name}`;
            }

            if (accounts.length === 0) {
                listContainer.innerHTML = "<p>ยังไม่มีบัญชีธนาคารสำหรับร้านนี้</p>";
            } else {
                accounts.forEach((account, index) => {
                    const row = document.createElement("div");
                    row.className = "bank-row";
                    row.innerHTML = `
              <div class="shop-info ${account.status ? "active" : "inactive"}">
                <span class="status-dot"></span>
                <span class="shop-name">${account.name}</span>
              </div>
              <div class="slip-check-option">
                <label class="switchBank">
                  <input type="checkbox" ${account.status ? "checked" : ""} onchange="toggleBankStatus('${prefix}', ${index}, this)">
                  <span class="slider"></span>
                </label>
              </div>
              <div class="buttons">
                <button class="line-btn-edit" onclick="openEditBankModal('${prefix}', ${index})">แก้ไข</button>
                <button class="line-btn-delete" onclick="deleteBank('${prefix}', ${index})">ลบ</button>
              </div>
            `;
                    listContainer.appendChild(row);
                });
            }

            // ✅ เพิ่มปุ่มด้านล่างรายการ
            const addBtn = document.createElement("button");
            addBtn.className = "btn btn-add-bank";
            addBtn.textContent = "+ เพิ่มธนาคารใหม่";
            addBtn.style.marginTop = "30px";
            addBtn.style.fontSize = "16px";
            addBtn.style.padding = "10px 20px";
            addBtn.style.borderRadius = "8px";
            addBtn.addEventListener("click", () => openAddBankModal(prefix));
            listContainer.appendChild(addBtn);
            
            modal.style.display = "flex";
        })
        .catch((err) => {
            console.error("เกิดข้อผิดพลาดในการโหลดบัญชีธนาคาร:", err);
        });
}

function openAddBankModal(prefix) {
    let modal = document.getElementById("addbankModal");

    // เปิด Modal
    modal.style.display = "flex";
    console.log("เปิด Modal แล้ว");

    // ค้นหาร้านค้าตาม prefix
    const shop = shopData.find(s => s.prefix === prefix);
    console.log("shop: ", shop);

    if (!shop) {
        console.error("ไม่พบข้อมูลร้าน");
        return;
    }

    // อัปเดตชื่อร้านใน Modal
    const shopName = shop.name;
    console.log("ชื่อร้าน: ", shopName); // ตรวจสอบชื่อร้าน

    document.getElementById("lineShopNameTitle").textContent = `เพิ่มบัญชีธนาคารสำหรับร้าน: ${shopName}`;

    // รีเซ็ตค่ากรอกข้อมูลใน input fields
    document.getElementById("bankAccountName").value = "";
    document.getElementById("bankAccountNumber").value = "";
}


// ปิด Modal
function closeAddBankModal() {
    document.getElementById("addbankModal").style.display = "none";
}

function closeBankModal() {
    const modal = document.getElementById("bankModal");
    if (modal) {
        modal.style.display = "none";  // ซ่อน Modal
    }
}

async function toggleBankStatus(prefix, index, checkbox) {
    const newStatus = checkbox.checked;
    try {
        const res = await fetch("/api/update-bank-status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prefix, index, status: newStatus }),
        });

        const result = await res.json();
        if (!result.success) {
            alert("ไม่สามารถอัปเดตสถานะบัญชีได้: " + result.message);
            checkbox.checked = !newStatus;
        }
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการอัปเดตสถานะบัญชีธนาคาร", err);
        alert("เกิดข้อผิดพลาดในการอัปเดตสถานะบัญชีธนาคาร");
        checkbox.checked = !newStatus;
    }
}

function openEditBankModal(prefix, index) {
    const modal = document.getElementById("editbankModal");
    const shop = shopData.find(s => s.prefix === prefix);
    if (!shop || !shop.bankAccounts || !shop.bankAccounts[index]) {
        console.error("ไม่พบข้อมูลร้านหรือบัญชีธนาคาร");
        return;
    }

    const account = shop.bankAccounts[index];
    document.getElementById("editBankAccountName").value = account.name;
    document.getElementById("editBankAccountNumber").value = account.account;

    modal.style.display = "flex";
}
function closeEditBankModal() {
    document.getElementById("editbankModal").style.display = "none";
}

function deleteBank(prefix, index) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบบัญชีนี้?")) return;
    fetch("/api/delete-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, index }),
    })
        .then((res) => res.json())
        .then((result) => {
            if (result.success) {
                alert("ลบบัญชีธนาคารเรียบร้อย");
                openBankModal(prefix);
            } else {
                alert("ไม่สามารถลบบัญชีธนาคารได้: " + result.message);
            }
        })
        .catch((err) => {
            console.error("เกิดข้อผิดพลาดในการลบบัญชีธนาคาร", err);
        });
}

function saveNewBank(prefix) {
    const name = document.getElementById("bankAccountName").value.trim();
    const number = document.getElementById("bankAccountNumber").value.trim();

    if (!name || !number) {
        alert("กรุณากรอกชื่อบัญชีและเลขบัญชีให้ครบ");
        return;
    }

    fetch("/api/add-bank", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefix, name, number })
    })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                alert("✅ เพิ่มบัญชีธนาคารสำเร็จ!");
                document.querySelector(".modal.bank-modal").remove();
                openBankModal(prefix);
            } else {
                alert("❌ ไม่สามารถเพิ่มบัญชีธนาคารได้: " + result.message);
            }
        })
        .catch(err => {
            console.error("เกิดข้อผิดพลาดในการเพิ่มบัญชีธนาคาร", err);
        });
}


function showAlertMessage(message, elementId = "alertMessageShop", isSuccess = false) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        return;
    }
    alertDiv.innerText = message;
    alertDiv.style.color = isSuccess ? "green" : "red";
    alertDiv.style.backgroundColor = isSuccess ? "#e6ffe6" : "#ffe6e6";
    alertDiv.style.border = isSuccess ? "1px solid green" : "1px solid red";
    alertDiv.style.display = "block";

    setTimeout(() => {
        alertDiv.style.display = "none";
    }, 3000);
}

async function addShop() {
    const shopName = document.getElementById("shopName").value.trim();
    const shopPrefix = document.getElementById("shopPrefix").value.trim();

    if (!shopName || !shopPrefix) {
        showAlertMessage("กรุณากรอกข้อมูลให้ครบถ้วน!", "alertMessageShop", false);
        return;
    }

    const response = await fetch("/api/add-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: shopName, prefix: shopPrefix })
    });

    const result = await response.json();
    if (result.success) {
        alert("เพิ่มร้านค้าสำเร็จ!");
        window.location.reload(); // รีเฟรชหน้า
    } else {
        showAlertMessage(result.message, "alertMessageShop", false);
    }
}

function closeBotSettingsModal() {
    document.getElementById("botSettingsModal").style.display = "none";
}


// ฟังก์ชันสำหรับอัปเดตสถานะร้านผ่าน API
async function updateShopStatus(prefix, newStatus) {
    try {
        const response = await fetch("/api/update-shop-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, status: newStatus })
        });

        const result = await response.json();
        if (result.success) {
            console.log(`✅ อัปเดตสถานะร้าน ${prefix} เป็น: ${newStatus ? "เปิด" : "ปิด"}`);
        } else {
            console.error(`❌ ไม่สามารถอัปเดตสถานะร้าน: ${result.message}`);
        }
    } catch (error) {
        console.error("❌ Error updating shop status:", error);
    }
}

// ฟังก์ชันสำหรับจัดการสวิตช์ (Toggle) เมื่อมีการเปลี่ยนแปลง
async function handleToggle(prefix, checkbox) {
    const newStatus = checkbox.checked; // true: เปิด, false: ปิด
    try {
        const response = await fetch("/api/update-shop", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prefix, status: newStatus })
        });

        const result = await response.json();
        if (result.success) {
            alert(`เปลี่ยนสถานะร้านค้าเป็น ${newStatus ? "เปิด" : "ปิด"} เรียบร้อย`);
            window.location.reload(); // รีโหลดหน้าเพื่ออัปเดตข้อมูล
        } else {
            alert("❌ ไม่สามารถอัปเดตสถานะร้านค้าได้: " + result.message);
            checkbox.checked = !newStatus; // กลับสถานะเดิมถ้าล้มเหลว
        }
    } catch (error) {
        console.error("Error updating shop status:", error);
        alert("❌ เกิดข้อผิดพลาดในการอัปเดตสถานะร้านค้า");
        checkbox.checked = !newStatus; // กลับสถานะเดิมถ้าล้มเหลว
    }
}

// ฟังก์ชันสำหรับลบร้านค้า
async function deleteShop(prefix) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบร้านค้า?")) return;
    try {
        const response = await fetch("/api/delete-shop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix })
        });
        if (!response.ok) {
            throw new Error("ไม่สามารถลบร้านค้าได้");
        }
        const result = await response.json();
        if (result.success) {
            window.location.reload();
        } else {
            alert("ไม่สามารถลบร้านค้าได้");
        }
    } catch (error) {
        console.error("Error deleting shop:", error);
        alert("เกิดข้อผิดพลาดในการลบร้านค้า");
    }
}

async function updateSlipCheckOption(prefix, newOption) {
    try {
        const response = await fetch("/api/update-slip-option", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, slipCheckOption: newOption })
        });

        const result = await response.json();
        if (result.success) {
            alert(`✅ เปลี่ยนตัวเลือกการตรวจสลิปเป็น "${newOption}" สำเร็จ!\nโปรดเปิดร้านใหม่อีกครั้งเพื่อให้มีผล.`);
            window.location.reload(); // รีโหลดหน้าหลังจากเปลี่ยนตัวเลือก
        } else {
            alert(`❌ ไม่สามารถอัปเดตตัวเลือกตรวจสลิป: ${result.message}`);
        }
    } catch (error) {
        console.error("❌ Error updating slip check option:", error);
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/api/shops");
        const data = await response.json();
        const shopListElement = document.getElementById("shop-list");

        if (!data.shops || data.shops.length === 0) {
            shopListElement.innerHTML = '<div class="no-shop">ยังไม่มีข้อมูลร้านค้า</div>';
            return;
        }

    } catch (error) {
        console.error("ไม่สามารถโหลดข้อมูลร้านค้า:", error);
    }
});

