const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ================= CẤU HÌNH DOWNLOAD =================
const OUTPUT_DIR = path.resolve(__dirname, 'output_images'); // Tên thư mục bạn muốn lưu
const FILE_NAME = 'cr7_2k_image_001.jpg'; // Tên file bạn muốn đổi

// Tạo thư mục nếu nó chưa tồn tại
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
    console.log(`📂 Đã tạo thư mục lưu trữ: ${OUTPUT_DIR}`);
}
// =====================================================

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
        // 3. HOVER VÀO "TẢI XUỐNG" 
        // ==========================================
        console.log('👉 3. Đang hover vào mục "Tải xuống"...');
        const downloadMenu = page.locator('text="Tải xuống"').last();
        await downloadMenu.waitFor({ state: 'visible', timeout: 5000 });
        await downloadMenu.hover();
        await page.waitForTimeout(1000);

        // ==========================================
        // 4. BẮT SỰ KIỆN DOWNLOAD VÀ LƯU FILE
        // ==========================================
        console.log(`👉 4. Đang bấm tải 2K và xử lý file...`);
        const resolution2K = page.getByText('2K', { exact: true }).last();
        await resolution2K.waitFor({ state: 'visible', timeout: 5000 });

        // Dùng Promise.all để vừa click vừa "hứng" luồng tải xuống cùng lúc
        const [download] = await Promise.all([
            page.waitForEvent('download'), // Đợi sự kiện download bật ra
            resolution2K.click()           // Thao tác click kích hoạt download
        ]);

        // Đường dẫn file đích
        const finalFilePath = path.join(OUTPUT_DIR, FILE_NAME);

        // Lệnh saveAs sẽ tự động dời file từ bộ nhớ tạm của Chrome sang thư mục bạn chọn và đổi tên
        await download.saveAs(finalFilePath);
        
        console.log(`✅ THÀNH CÔNG! File đã được lưu tại:\n   📁 ${finalFilePath}`);

    } catch (error) {
        console.error('❌ Thất bại:', error.message);
    }

    process.exit();
})();