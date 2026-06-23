const { chromium } = require('playwright');

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
        await page.waitForTimeout(1000);

        // ==========================================
        // 1. KHÓA MỤC TIÊU VÀO Ô ẢNH MỚI NHẤT & CHỜ TẢI
        // ==========================================
        console.log('👉 1. Đang giám sát ô ảnh mới nhất (đầu tiên)...');
        
        // BƯỚC A: Lấy "cái khung" đầu tiên nhất của index-0 (vị trí ảnh mới nhất)
        // Bất kể nó đang hiện % tải hay hiện ảnh, nó luôn có thuộc tính data-tile-id
        const firstTileBox = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
        
        // BƯỚC B: Tìm thẻ img NẰM NGAY BÊN TRONG cái khung đầu tiên đó
        // Nếu khung đang tải, thẻ này chưa tồn tại -> Playwright sẽ đứng chờ.
        const newestImage = firstTileBox.locator('img[alt="Hình ảnh được tạo"]');
        
        console.log('⏳ Đang chờ ảnh tạo xong (có thể mất vài chục giây)...');
        // Chờ tối đa 2 phút cho đến khi ảnh trong cái khung đầu tiên xuất hiện
        await newestImage.waitFor({ state: 'visible', timeout: 120000 });
        
        console.log('✅ Ảnh mới nhất đã xuất hiện! Tiến hành hover...');
        await page.waitForTimeout(10000);
        
        // Ép hover thẳng vào chính bức ảnh mới đó
        await newestImage.hover({ force: true });
        
        await page.waitForTimeout(1000); 

        // ==========================================
        // 2. KHOANH VÙNG VÀ BẤM NÚT 3 CHẤM
        // ==========================================
        console.log('👉 2. Đang định vị nút 3 chấm theo Radix ID...');
        const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
        const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
        
        await threeDotsBtn.waitFor({ state: 'visible', timeout: 10000 });
        await threeDotsBtn.hover({ force: true });
        await page.waitForTimeout(500); 
        await threeDotsBtn.click({ force: true });
        await page.waitForTimeout(1000); 

        // ==========================================
        // 3. CHỌN "THÊM VÀO CÂU LỆNH"
        // ==========================================
        console.log('👉 3. Đang chọn "Thêm vào câu lệnh"...');
        const addToPromptMenu = page.locator('text="Thêm vào câu lệnh"').last();
        await addToPromptMenu.waitFor({ state: 'visible', timeout: 5000 });
        await addToPromptMenu.click({ force: true });
        
        await page.waitForTimeout(1000);

        // ==========================================
        // 4. NHẬP PROMPT MỚI
        // ==========================================
        console.log('👉 4. Đang nhập câu lệnh mới...');
        const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
        await chatBox.waitFor({ state: 'visible', timeout: 5000 });
        
        await chatBox.click();
        await page.keyboard.type(PROMPT_TEXT, { delay: 10 });
        await page.waitForTimeout(500);

        // ==========================================
        // 5. BẤM NÚT GỬI (TẠO)
        // ==========================================
        console.log('👉 5. Đang bấm nút Gửi...');
        // const sendBtn = page.locator('button:has(i:text-is("arrow_forward"))').first();
        // await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
        // await sendBtn.click();

        console.log('✅ THÀNH CÔNG! Đã thêm ảnh, gõ câu lệnh và sẵn sàng chạy.');

    } catch (error) {
        console.error('❌ Thất bại:', error.message);
    }

    process.exit();
})();