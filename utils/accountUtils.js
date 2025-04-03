
export function isValidAccount(receiverValue, accounts) {
    console.log('ตรวจสอบบัญชีที่ active...');
    for (const account of accounts) {
        if (!account.active) {
            console.log(`บัญชี ${account.name} ถูกปิดใช้งาน (active: false)`);
            continue; // ข้ามบัญชีที่ไม่ active
        }
        console.log(`กำลังตรวจสอบบัญชี: ${account.name}, ${account.account}`);
        if (isAccountNumberMatch(receiverValue, account.account)) {
            console.log(`บัญชี ${account.name} ตรงกับ ${receiverValue}`);
            return true; // หยุดทันทีเมื่อเจอบัญชีที่ตรง
        }
    }
    console.log(`ไม่พบบัญชีปลายทางที่ active ตรงกับ: ${receiverValue}`);
    return false; // หากไม่มีบัญชีใดที่ active ตรงกัน
}

export function cleanReceiverName(name) {
    if (!name) return "";
    return name
        .replace(/^(s\.|r\.|mrs\.?|mr\.?|miss\.?|mister\.?|ms\.?|บจก\.?|นางสาว|นาย|นาง|นส\.?|น\.ส\.?)\.?\s*/i, '')  // ✅ ลบคำนำหน้า 
        .replace(/[^a-zA-Zก-๙\s]/g, '')  // ✅ ลบอักขระพิเศษ
        .replace(/\s+/g, '') 
        .toLowerCase();
}

export function extractFirstNameAndTrimLastName(fullName) {
    if (!fullName) return "";

    const cleanedName = cleanReceiverName(fullName).trim(); // ✅ ทำความสะอาดชื่อก่อน
    const nameParts = cleanedName.split(/\s+/); // ✅ แยกชื่อออกเป็นคำ

    if (nameParts.length >= 2) {
        return `${nameParts[0]} ${nameParts[1][0]}`; // ✅ ใช้แค่ชื่อแรก + ตัวแรกของนามสกุล
    } else {
        return nameParts[0]; // ✅ ถ้ามีแค่ชื่อ ให้ใช้ชื่อนั้นเลย
    }
}


export function isNameMatch(receiverName, account) {
    console.log('🔍 ตรวจสอบชื่อบัญชี...');

    if (!receiverName || !account) {
        console.log("❌ receiverName หรือ account เป็น undefined");
        return false;
    }

    // ✅ ใช้ฟังก์ชันที่ถูกต้องในการทำความสะอาดชื่อ
    const normalizedReceiver = extractFirstNameAndTrimLastName(receiverName);
    const normalizedTH = extractFirstNameAndTrimLastName(account.THname);
    const normalizedENG = extractFirstNameAndTrimLastName(account.ENGname);

    console.log(`🛠️ กำลังเปรียบเทียบ: ${normalizedReceiver} กับ ${normalizedTH} / ${normalizedENG}`);

    if (normalizedReceiver === normalizedTH || normalizedReceiver === normalizedENG) {
        console.log(`✅ ชื่อบัญชีตรงกับ ${receiverName}`);
        return true;
    }

    console.log(`❌ ไม่พบบัญชีที่ตรงกับ: ${receiverName}`);
    return false;
}

export function isAccountNumberMatch(receiverValue, accountValue) {

    // สร้างตัวแปรสำรองที่ผ่านการจัดรูปแบบ (Sanitize) สำหรับการตรวจสอบ
    const sanitizedReceiver = receiverValue.replace(/[^0-9xX]/g, '').toUpperCase();
    const sanitizedAccount = accountValue.replace(/[^0-9]/g, '');

    // หากความยาวไม่เท่ากัน ให้ถือว่าไม่ตรงกันทันที
    if (sanitizedReceiver.length !== sanitizedAccount.length) {
        console.log(`ความยาวตัวเลขไม่เท่ากัน: บัญชีในสลิปมีตัวเลข ${sanitizedReceiver.length} หลัก,  บัญชีปลายทางมีตัวเลข ${sanitizedAccount.length} หลัก`);
        return false;
    }

    // ตรวจสอบตำแหน่งตัวอักษร/ตัวเลขที่ไม่ตรงกัน
    for (let i = 0; i < sanitizedReceiver.length; i++) {
        const receiverChar = sanitizedReceiver[i];
        const accountChar = sanitizedAccount[i];

        // ถ้าตำแหน่งใดไม่ตรงกัน และ Receiver ไม่ใช่ 'x' ให้ถือว่าไม่ตรงกัน
        if (receiverChar !== 'X' && receiverChar !== accountChar) {
            console.log(`ตัวเลขไม่ตรงกันในตำแหน่ง ${i + 1}: บัญชีในสลิปมีตัวเลข ${receiverChar} ,  บัญชีปลายทางมีตัวเลข ${accountChar}`);
            return false;
        }
    }

    return true;
}


