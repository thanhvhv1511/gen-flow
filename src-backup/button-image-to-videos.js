const { chromium } = require('playwright');

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
    let page = context.pages()[0]; 

    if (!page) {
        console.log('❌ Không tìm thấy tab nào đang mở!');
        process.exit();
        return;
    }

    try {
        console.log(`🎯 Đang thao tác trên tab: "${await page.title()}"`);

        // ==========================================
        // 1. CHỜ GIAO DIỆN SẴN SÀNG
        // ==========================================
        console.log('⏳ Đang chờ khung chat tải xong...');
        const chatBox = page.locator('div[role="textbox"]').first();
        await chatBox.waitFor({ state: 'visible', timeout: 30000 }); 
        await page.waitForTimeout(100); 

        // ==========================================
        // 2. MỞ MENU CẤU HÌNH 
        // ==========================================
        console.log('👉 Đang tìm và click nút cấu hình mô hình...');
        
        const configBtn = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Banana|Nano|Video/i }).first();
        await configBtn.waitFor({ state: 'visible', timeout: 10000 });
        await configBtn.click({ force: true });
        
        console.log('⏳ Đang chờ menu bung ra...');
        const menuContainer = page.locator('[role="menu"], [data-radix-menu-content]').last();
        await menuContainer.waitFor({ state: 'visible', timeout: 10000 });
        
        console.log('✅ Menu đã mở thành công!');

        // ==========================================
        // 3. THAO TÁC BÊN TRONG MENU 
        // ==========================================
        
        // 3.1. Chọn tab "Video"
        console.log('👉 Chọn tab Video...');
        const videoTab = menuContainer.locator('button[role="tab"]:has-text("Video")').first();
        await videoTab.waitFor({ state: 'visible', timeout: 5000 });
        await videoTab.click();
        await page.waitForTimeout(100);

        // 3.2. Chọn "Thành phần" 
        console.log('👉 Chọn Thành phần...');
        const thanhPhanBtn = menuContainer.locator('button[role="tab"]:has-text("Thành phần")').first();
        await thanhPhanBtn.click();
        await page.waitForTimeout(100);

        // 3.3. Chọn khung hình "9:16"
        console.log('👉 Chọn khung hình 9:16...');
        const ratioBtn = menuContainer.locator('button[role="tab"]:has-text("9:16")').first();
        await ratioBtn.click();
        await page.waitForTimeout(100);

        // 3.4. Chọn số lượng "1x"
        console.log('👉 Chọn số lượng 1x...');
        const quantityBtn = menuContainer.locator('button[role="tab"]:text-is("1x")').first();
        await quantityBtn.click();
        await page.waitForTimeout(100);

        // 3.5. Kiểm tra và chọn model "Omni Flash"
        console.log('👉 Kiểm tra và chọn Omni Flash...');
        const modelDropdown = menuContainer.locator('button[aria-haspopup="menu"]').first();
        
        if (await modelDropdown.isVisible()) {
            const currentModelText = await modelDropdown.innerText();
            if (!currentModelText.includes("Omni Flash")) {
                await modelDropdown.click();
                await page.waitForTimeout(100);
                
                // ĐÃ FIX LỖI CÚ PHÁP TẠI ĐÂY: Dùng filter để tìm chính xác thẻ chứa chữ Omni Flash
                const omniOption = page.locator('button, [role="menuitem"], [role="option"]').filter({ hasText: 'Omni Flash' }).last();
                await omniOption.click();
            }
        }
        await page.waitForTimeout(100);

        // 3.6. Chọn thời lượng "10s"
        console.log('👉 Chọn thời lượng 10s...');
        const duration10sBtn = menuContainer.locator('button[role="tab"]:has-text("10s")').first();
        await duration10sBtn.click();
        await page.waitForTimeout(100);
        
        // ==========================================
        // 4. ĐÓNG MENU 
        // ==========================================
        console.log('👉 Đang đóng menu...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

        console.log('\n🎉 ĐÃ CẤU HÌNH CHUYỂN ĐỔI SANG TẠO VIDEO THÀNH CÔNG!');

    } catch (error) {
        console.error('\n❌ Có lỗi xảy ra trong quá trình thực hiện nghiệp vụ:', error.message);
    } finally {
        console.log('Hoàn tất tiến trình.');
        process.exit();
    }
})();