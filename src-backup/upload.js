const { chromium } = require('playwright');
const path = require('path');

// Đường dẫn ảnh test (Nhớ bỏ 1 ảnh test.jpg vào thư mục input_images)
const TEST_IMAGE = path.resolve(__dirname, 'input_image.jpg'); 

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
        // BƯỚC 1: BẤM NÚT DẤU "+"
        // ==========================================
        console.log('👉 1. Đang tìm và bấm nút dấu "+" ...');
        
        // Đã cập nhật Selector: Tìm button có chứa thẻ <i> mang chữ "add_2"
        const plusBtn = page.locator('button:has(i:text-is("add_2"))').first();
        
        await plusBtn.waitFor({ state: 'visible', timeout: 5000 });
        await plusBtn.click();
        
        // Nghỉ 1 giây để đợi menu pop-up (chứa chữ "Tải nội dung nghe nhìn lên") bung ra
        await page.waitForTimeout(1000); 

        // ==========================================
        // BƯỚC 2: BẤM "TẢI NỘI DUNG NGHE NHÌN LÊN"
        // ==========================================
        console.log('👉 2. Đang bấm "Tải nội dung nghe nhìn lên"...');
        
        const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            // Chọn chính xác item menu
            page.locator('text="Tải nội dung nghe nhìn lên"').last().click()
        ]);

        console.log('👉 3. Đã mở được cửa sổ chọn file! Đang đính kèm ảnh...');
        await fileChooser.setFiles(TEST_IMAGE);
        
        console.log('✅ THÀNH CÔNG! Đã đính kèm ảnh xong. Script dừng tại đây.');

    } catch (error) {
        console.error('❌ Thất bại:', error.message);
    }

    process.exit();
})();