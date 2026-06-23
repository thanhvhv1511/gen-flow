const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ==========================================
// CẤU HÌNH CHUNG & THỜI GIAN CHỜ
// ==========================================
const OUTPUT_DIR = path.resolve(__dirname, 'output_videos'); 
const BASE_FILE_NAME = 'cr7_1080_video'; 

const DELAY_SHORT = 500;
const DELAY_MEDIUM = 3000;

// HÀM KIỂM TRA VÀ TẠO TÊN FILE KHÔNG TRÙNG LẶP (CHỐNG GHI ĐÈ)
function getUniqueFilePath(dir, baseName, extension) {
    let fileName = `${baseName}${extension}`;
    let filePath = path.join(dir, fileName);
    let counter = 1;

    while (fs.existsSync(filePath)) {
        fileName = `${baseName}_(${counter})${extension}`;
        filePath = path.join(dir, fileName);
        counter++;
    }
    return filePath;
}

// Tạo thư mục nếu chưa có
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
    console.log(`📂 Đã tạo thư mục lưu trữ: ${OUTPUT_DIR}`);
}

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
        let loopIndex = 1; // Giả lập index để điền vào tên file

        // ==========================================
            // BƯỚC 7: BẤM GỬI (TẠO VIDEO MỚI)
            // ==========================================
            console.log('👉 7. Đang bấm nút Gửi để AI tạo video...');
            const sendBtn_2 = page.locator('button:has(i:text-is("arrow_forward"))').first();
            await sendBtn_2.waitFor({ state: 'visible', timeout: 5000 });
            
            // 🎯 TRƯỚC KHI BẤM GỬI: Đếm xem hiện tại đang có bao nhiêu video trên màn hình
            const currentVideoCount = await page.locator('video').count();
            console.log(`Đang có ${currentVideoCount} video`);
            
            // Bấm gửi prompt
            await sendBtn_2.click();
            await page.waitForTimeout(2000);

            // ==========================================
            // BƯỚC 8: CHỜ VIDEO MỚI XONG VÀ HOVER VÀO NÚT 3 CHẤM
            // ==========================================
            console.log(`👉 8. Đang chờ VIDEO MỚI NHẤT tạo xong (quá trình này mất 2-3 phút)...`);
            
            // 🎯 ÉP CHỜ: Bắt trình duyệt đứng im cho đến khi số lượng thẻ <video> nhiều hơn lúc nãy
            await page.waitForFunction(
                (old_count) => document.querySelectorAll('video').length > old_count,
                currentVideoCount,
                { timeout: 300000 } // Đợi tối đa 5 phút
            );

            console.log('✅ Precheck ok, đang ép hiển thị video...');

            // 1. Khóa mục tiêu vào khung chứa mới nhất
            const tileBoxVideo = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
            
            // 2. Ép trình duyệt cuộn khung này vào giữa màn hình để trình duyệt kích hoạt render
            await tileBoxVideo.scrollIntoViewIfNeeded();
            await page.waitForTimeout(DELAY_SHORT);

            // 3. Hover vào khung để ép các thành phần bên trong (thẻ video) phải "thức dậy"
            await tileBoxVideo.hover({ force: true });
            await page.waitForTimeout(DELAY_MEDIUM); // Chờ 3s cho video load từ server về

            // 4. Bây giờ mới tìm thẻ video
            const newVideo = tileBoxVideo.locator('video').first();
            
            // Dùng 'attached' thay vì 'visible' vì nó có thể vẫn ở trạng thái ẩn nhưng đã nằm trong DOM
            await newVideo.waitFor({ state: 'attached', timeout: 30000 });
            console.log('✅ Video đã được kích hoạt! Bắt đầu tiến trình tải xuống...');
            
            // 5. Hover vào chính thẻ video để hiện nút 3 chấm
            await newVideo.hover({ force: true }); 
            await page.waitForTimeout(DELAY_SHORT);
            
            // SỬA LỖI Ở ĐÂY: Sử dụng đúng biến newVideo để hover
            await newVideo.hover(); 
            await page.waitForTimeout(DELAY_SHORT); 

            const visibleToolbarVideo = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtnVideo = visibleToolbarVideo.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtnVideo.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtnVideo.hover();
            await page.waitForTimeout(DELAY_SHORT); 
            await threeDotsBtnVideo.click();
            await page.waitForTimeout(DELAY_SHORT); 

    } catch (error) {
        console.error(`\n❌ Thất bại:`, error.message);
        // Nhấn ESC phòng trường hợp menu bị kẹt mở
        await page.keyboard.press('Escape'); 
        await page.waitForTimeout(1000);
    } finally {
        console.log('\n🎉 KẾT THÚC TIẾN TRÌNH!');
        process.exit();
    }
})();