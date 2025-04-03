import axios from 'axios';

export async function validateAccessToken(accessToken) {
    try {
        const response = await axios.get("https://api.line.me/v2/bot/info", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return { valid: true, message: "Access Token ถูกต้อง" };
    } catch (error) {
        return {
            valid: false,
            error: "INVALID_ACCESS_TOKEN",
            message: `Access Token ไม่ถูกต้อง (Status Code: ${error.response?.status || "UNKNOWN"})`,
            details: error.response?.data || error.message,
        };
    }
}
