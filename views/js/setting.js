(function() {
    const DEFAULT_SETTINGS = {
      timeLimit: 120,
      sameQrTimeLimit: 1200,
      maxMessagesPerUser: 3,
      maxMessagesSamePerUser: 2,
      maxProcessingPerUser: 2
    };
  
    // ✅ โหลดค่าจาก backend และแปลง ms → s เพื่อแสดง
    async function loadSettings() {
        try {
          const response = await fetch('/api/settings');
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
          const settings = await response.json();
      
          document.getElementById('timeLimit').value = settings.timeLimit;
          document.getElementById('sameQrTimeLimit').value = settings.sameQrTimeLimit;
          document.getElementById('maxMessagesPerUser').value = settings.maxMessagesPerUser;
          document.getElementById('maxMessagesSamePerUser').value = settings.maxMessagesSamePerUser;
          document.getElementById('maxProcessingPerUser').value = settings.maxProcessingPerUser;
      
        } catch (error) {
          console.error('Error loading settings:', error);
          alert('ไม่สามารถโหลดการตั้งค่าได้: ' + error.message);
        }
      }
  
    // ✅ บันทึกค่าจาก form โดยแปลง s → ms ก่อนส่ง
    async function saveSettings() {
      try {
        const saveBtn = document.querySelector('.save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'กำลังบันทึก...';
  
        const settings = {
          timeLimit: parseInt(document.getElementById('timeLimit').value) * 1000,          // s → ms
          sameQrTimeLimit: parseInt(document.getElementById('sameQrTimeLimit').value) * 1000,
          maxMessagesPerUser: parseInt(document.getElementById('maxMessagesPerUser').value),
          maxMessagesSamePerUser: parseInt(document.getElementById('maxMessagesSamePerUser').value),
          maxProcessingPerUser: parseInt(document.getElementById('maxProcessingPerUser').value)
        };
  
        for (const [key, value] of Object.entries(settings)) {
          if (isNaN(value) || value < 0) {
            throw new Error(`ค่า ${key} ไม่ถูกต้อง`);
          }
        }
  
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(settings)
        });
  
        const result = await response.json();
        if (result.success) {
          alert('บันทึกการตั้งค่าเรียบร้อย');
        } else {
          throw new Error(result.error || 'ไม่สามารถบันทึกการตั้งค่าได้');
        }
  
      } catch (error) {
        console.error('Save error:', error);
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
      } finally {
        const saveBtn = document.querySelector('.save-btn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'บันทึกการตั้งค่า';
      }
    }
  
    // ✅ คืนค่าเริ่มต้น (เฉพาะ s) และส่งไป backend แปลงเป็น ms ฝั่ง server
    async function resetSettings() {
      if (confirm('ต้องการคืนค่าเริ่มต้นทั้งหมด?')) {
        try {
          const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timeLimit: DEFAULT_SETTINGS.timeLimit * 1000,
              sameQrTimeLimit: DEFAULT_SETTINGS.sameQrTimeLimit * 1000,
              maxMessagesPerUser: DEFAULT_SETTINGS.maxMessagesPerUser,
              maxMessagesSamePerUser: DEFAULT_SETTINGS.maxMessagesSamePerUser,
              maxProcessingPerUser: DEFAULT_SETTINGS.maxProcessingPerUser
            })
          });
  
          const result = await response.json();
          if (result.success) {
            Object.keys(DEFAULT_SETTINGS).forEach(key => {
              document.getElementById(key).value = DEFAULT_SETTINGS[key];
            });
            alert('คืนค่าเริ่มต้นเรียบร้อย');
          } else {
            throw new Error(result.error || 'ไม่สามารถคืนค่าเริ่มต้นได้');
          }
  
        } catch (error) {
          console.error('Reset error:', error);
          alert('เกิดข้อผิดพลาดในการคืนค่าเริ่มต้น: ' + error.message);
        }
      }
    }
  
    // 🔁 Export ฟังก์ชัน global
    window.resetSettings = resetSettings;
    window.loadSettings = loadSettings;
    window.saveSettings = saveSettings;
  
    // ⏳ โหลดค่าทันทีเมื่อ DOM พร้อม
    function waitForElement(id, callback) {
        const el = document.getElementById(id);
        if (el) {
          callback();
        } else {
          setTimeout(() => waitForElement(id, callback), 100); // รอวนไปจนกว่าจะเจอ element
        }
      }
      
      // เรียก loadSettings ทันทีเมื่อ input ทั้งหมดพร้อม
      waitForElement("maxProcessingPerUser", loadSettings);
  })();
  