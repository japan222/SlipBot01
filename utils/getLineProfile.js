import line from "@line/bot-sdk";

export async function getLineProfile(userId, accessToken) {
  if (!userId || !accessToken) {
    console.warn("⚠️ userId หรือ accessToken ไม่ถูกต้อง", { userId, tokenPreview: accessToken?.slice(0, 10) });
    return null;
  }

  try {
    const client = new line.Client({ channelAccessToken: accessToken });
    const profile = await client.getProfile(userId);

    return {
      displayName: profile.displayName || "-",
      pictureUrl: profile.pictureUrl || ""
    };
  } catch (err) {
    console.error("❌ ดึงโปรไฟล์ LINE ล้มเหลว อาจเป็นผู้ใช้ใหม่ หรือไม่ระบุชื่อ");
    return null;
  }
}