/**
 * ฟังก์ชันสำหรับส่งข้อความ Flex Message ตอบกลับกรณีสลิปถูกต้อง
 * @param {string} replyToken - Token สำหรับการตอบกลับ LINE Messaging API
 * @param {Object} client - LINE Client สำหรับส่งข้อความ
 * @param {string} transRef - Reference Transaction ID
 * @param {string} amount - จำนวนเงิน
 * @param {string} fromName - ชื่อผู้โอน
 * @param {string} fromAccount - ชื่อธนาคารต้นทาง
 * @param {string} toName - ชื่อผู้รับ
 * @param {string} toAccount - ชื่อธนาคารปลายทาง
 */

export async function sendMessageWrong(replyToken, client, transRef, amount, fromName, fromAccount, toName, toAccount ) {
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
                "text": "รายการปลายทาง",
                "size": "25px",
                "color": "#de3515",
                "align": "center",
                "weight": "bold",
                "position": "relative",
                "margin": "md"
              },
              {
                "type": "text",
                "text": "ไม่ถูกต้อง ❌",
                "size": "25px",
                "color": "#de3515",
                "align": "center",
                "weight": "bold",
                "position": "relative",
                "margin": "none"
              },
              {
                "type": "text",
                "text": `${amount} บาท`,
                "weight": "bold",
                "size": "xxl",
                "margin": "md",
                "align": "center"
              }
            ]
          },
          {
            "type": "separator",
            "margin": "xl"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "จาก",
                "size": "md",
                "flex": 2,
                "weight": "bold"
              },
              {
                "type": "text",
                "text": fromName,
                "flex": 3,
                "wrap": false,
                "align": "end",
                "weight": "bold"
              }
            ],
            "offsetTop": "sm",
            "margin": "md"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": fromAccount,
                "flex": 3,
                "wrap": false,
                "align": "end",
                "weight": "bold"
              }
            ],
            "offsetTop": "sm",
            "margin": "md"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "ไปยัง",
                "size": "md",
                "flex": 2,
                "weight": "bold",
                "color": "#de3515"
              },
              {
                "type": "text",
                "text": toName,
                "flex": 3,
                "wrap": false,
                "align": "end",
                "weight": "bold",
                "color": "#de3515"
              }
            ],
            "offsetTop": "sm",
            "margin": "lg"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": toAccount,
                "flex": 3,
                "wrap": false,
                "align": "end",
                "weight": "bold",
                "color": "#de3515"
              }
            ],
            "offsetTop": "sm",
            "margin": "md"
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
                "text": transRef,
                "color": "#aaaaaa",
                "size": "xs",
                "align": "end",
                "flex": 4
              }
            ]
          }
        ]
      }
    };

    try {
      // ส่งข้อความผ่าน LINE Messaging API
      await client.replyMessage(replyToken, { type: "flex", altText: "🔴 สลิปไม่ถูกต้อง บัญชีปลายทางไม่ตรงที่กำหนดไว้ ❌", contents: flexMessage });
      console.log("ตอบกลับแล้ว สลิปไม่ถูกต้อง บัญชีปลายทางไม่ตรงที่กำหนดไว้ ❌");
  } catch (err) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ Flex Message:", err.message || err);
  }
  }  