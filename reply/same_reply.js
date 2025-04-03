/**
 * ฟังก์ชันสำหรับส่งข้อความ Flex Message ตอบกลับกรณีสลิปซ้ำ
 * @param {string} replyToken - Token สำหรับการตอบกลับ LINE Messaging API
 * @param {Object} client - LINE Client สำหรับส่งข้อความ
 * @param {string} qrInfo - QR Code Data ที่ใช้ตรวจสอบสลิปซ้ำ
 * @param {string} qrData - Reference Transaction ID
 * @param {string} amount - Reference Transaction ID
 * @returns {Promise<void>} - Promise ที่ส่งสถานะการส่งข้อความกลับไปยังไฟล์หลัก
 */
export async function sendMessageSame(replyToken, client, qrInfo, qrData) {
    // สร้าง Flex Message
    const flexMessage = {
      "type": "bubble",
      "hero": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "image",
            "url": "https://imgur.com/DywRa1y.png",
            "align": "start",
            "gravity": "top",
            "size": "xxl",
            "margin": "lg",
            "aspectMode": "fit",
            "aspectRatio": "20:9",
            "offsetStart": "20px",
            "offsetBottom": "3px"
          }
        ],
        "margin": "none",
        "spacing": "none",
        "background": {
          "type": "linearGradient",
          "angle": "10deg",
          "endColor": "#81b3eb",
          "startColor": "#d4e8ff"
        }
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "text",
                "text": "รายการซ้ำ ❌",
                "size": "25px",
                "color": "#de3515",
                "align": "center",
                "weight": "bold",
                "position": "relative",
                "margin": "md"
              },
              {
                "type": "text",
                "text": "สลิปนี้เคยถูกส่งมาตรวจสอบแล้ว",
                "size": "18px",
                "align": "center",
                "weight": "bold",
                "position": "relative",
                "margin": "md",
                "wrap": true
              }
            ]
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "เมื่อวันที่",
                "size": "md",
                "flex": 2,
                "weight": "bold"
              },
              {
                "type": "text",
                "text": qrInfo,
                "flex": 3,
                "wrap": false,
                "align": "end",
                "weight": "bold"
              }
            ],
            "offsetTop": "sm",
            "margin": "sm"
          },
          {
            "type": "separator",
            "margin": "xl"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "margin": "md",
            "contents": [
              {
                "type": "text",
                "text": "เลขอ้างอิง",
                "size": "xs",
                "color": "#aaaaaa",
                "flex": 2
              },
              {
                "type": "text",
                "text": qrData,
                "color": "#aaaaaa",
                "size": "xs",
                "align": "end",
                "flex": 4
            }
          ]
        }
      ]
    }
  }

      try {
        // ส่งข้อความผ่าน LINE Messaging API
        await client.replyMessage(replyToken, { type: "flex", altText: "🔴 สลิปซ้ำ เคยส่งมาตรวจสอบแล้ว ❌", contents: flexMessage });
        console.log("ตอบกลับแล้ว สลิปซ้ำ ❌");
    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการส่งข้อความ Flex Message:", err.message || err);
    }
}          