
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


