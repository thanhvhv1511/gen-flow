const { chromium } = require('playwright');

// Nội dung prompt bạn muốn nhập thêm
const PROMPT_TEXT = "Hãy tạo một video motion tự nhiên từ bức ảnh này, góc máy quay ngang.";

(async () => {
    console.log('🔗 Đang kết nối vào Chrome qua port 9522...');
    let browser;
    try {
        browser = await chromium.connectOverCDP('http://localhost:9522');
    } catch (error) {
        console.log('❌ Lỗi kết nối! Kiểm tra lại port 9522.');
        return;
    }
    
    const context = browser.contexts()[0];
    let page = context.pages().find(p => p.url().toLowerCase().includes('labs.google'));
    
    if (!page) {
        console.log('❌ Không tìm thấy tab Google Labs hợp lệ.');
        process.exit();
        return;
    }

    console.log(`🎯 Đã nhắm trúng tab: "${await page.title()}"`);

    try {
        // ==========================================
        // 1. HOVER VÀO ẢNH
        // ==========================================
        console.log('👉 1. Đang hover vào ảnh được tạo...');
        const targetImage = page.locator('img[alt="Hình ảnh được tạo"]').first();
        await targetImage.waitFor({ state: 'visible', timeout: 5000 });
        await targetImage.hover();
        
        await page.waitForTimeout(1000); 

        // ==========================================
        // 2. KHOANH VÙNG VÀ BẤM NÚT 3 CHẤM (DÙNG RADIX ID)
        // ==========================================
        console.log('👉 2. Đang định vị nút 3 chấm theo Radix ID...');
        const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
        const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
        
        await threeDotsBtn.waitFor({ state: 'visible', timeout: 5000 });
        await threeDotsBtn.hover();
        await page.waitForTimeout(500); 
        await threeDotsBtn.click();
        await page.waitForTimeout(1000); 

        // ==========================================
        // 3. CHỌN "THÊM VÀO CÂU LỆNH"
        // ==========================================
        console.log('👉 3. Đang chọn "Thêm vào câu lệnh"...');
        const addToPromptMenu = page.locator('text="Thêm vào câu lệnh"').last();
        await addToPromptMenu.waitFor({ state: 'visible', timeout: 5000 });
        await addToPromptMenu.click();
        
        // Nghỉ 1 giây để ảnh kịp nhảy xuống ô input
        await page.waitForTimeout(1000);

        // ==========================================
        // 4. NHẬP PROMPT MỚI
        // ==========================================
        console.log('👉 4. Đang nhập câu lệnh mới...');
        // Tìm ô nhập liệu (textbox)
        const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
        await chatBox.waitFor({ state: 'visible', timeout: 5000 });
        
        // Click vào ô input để con trỏ chuột nhấp nháy ở đó
        await chatBox.click();
        
        // (Tùy chọn) Bôi đen xóa text cũ nếu có: await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
        
        // Giả lập gõ phím như người thật (delay 10ms mỗi ký tự để tránh lỗi nhận diện)
        await page.keyboard.type(PROMPT_TEXT, { delay: 10 });
        
        await page.waitForTimeout(500);

        // ==========================================
        // 5. BẤM NÚT GỬI (TẠO)
        // ==========================================
        console.log('👉 5. Đang bấm nút Gửi...');
        // Nút gửi thường chứa icon mũi tên tiến lên (arrow_forward)
        const sendBtn = page.locator('button:has(i:text-is("arrow_forward"))').first();
        await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
        await sendBtn.click();

        console.log('✅ THÀNH CÔNG! Đã thêm ảnh, gõ câu lệnh và bấm chạy.');

    } catch (error) {
        console.error('❌ Thất bại:', error.message);
    }

    process.exit();
})();