const { chromium } = require('playwright');
const config = require('./config');
const utils = require('./utils');
const flow = require('./flowActions');

(async () => {
    // Khởi tạo tài nguyên hệ thống trước khi chạy automation
    utils.ensureDirExists(config.OUTPUT_DIR);
    const PROMPT_TEXT_IMAGE = utils.readPromptFile(config.PROMPT_FILE_IMAGE);
    const PROMPT_TEXT_VIDEO = utils.readPromptFile(config.PROMPT_FILE_VIDEO);

    console.log(`🔗 Khởi động tiến trình kết nối CDP qua cổng: ${config.CDP_URL}...`);
    let browser;
    try {
        browser = await chromium.connectOverCDP(config.CDP_URL);
    } catch (error) {
        console.error('❌ Thất bại kết nối CDP! Vui lòng đảm bảo Chrome debug mode đã bật trên port 9522.');
        return;
    }
    
    const context = browser.contexts()[0];
    let page = context.pages()[0] || (await context.newPage());

    // Thiết lập trạng thái điều hướng workspace ban đầu
    try {
        page = await flow.handleProjectNavigation(page);
    } catch (error) {
        console.error('❌ Xảy ra lỗi trong tiến trình thiết lập phiên làm việc:', error.message);
    }

    console.log('⏳ Đợi không gian làm việc đồng bộ hóa dữ liệu trực quan...');
    const chatBoxInit = page.locator('div[role="textbox"]').first();
    await chatBoxInit.waitFor({ state: 'visible', timeout: 30000 }); 
    await page.waitForTimeout(config.DELAY_MEDIUM);
    console.log('✅ Hệ thống Flow đã sẵn sàng! Bắt đầu kích hoạt tiến trình tuần hoàn...');

    // VÒNG LẶP CHÍNH (MAIN AUTOMATION LOOP)
    for (let i = 1; i <= config.LOOP_COUNT; i++) {
        console.log(`\n==========================================`);
        console.log(`🚀 BẮT ĐẦU VÒNG LẶP THỨ ${i}/${config.LOOP_COUNT}`);
        console.log(`==========================================`);

        try {
            // Bước 1: Upload hình ảnh gốc lên khung chat
            await flow.uploadInitialImage(page);

            // Bước 2: Điền prompt chữ tạo hình ảnh mới và cấu hình tham số tỷ lệ 9:16
            await flow.configureAndFillImagePrompt(page, PROMPT_TEXT_IMAGE);

            // Bước 3: Đợi ảnh gốc tải lên thành công, hover và nhấn "Thêm vào câu lệnh"
            await flow.addLatestTileToPrompt(page);

            // Bước 4: Nhấn nút gửi để AI sinh ảnh biến thể mới (Variant Image)
            await flow.submitPrompt(page);

            // Bước 5: Chờ ảnh biến thể mới tạo xong, tiếp tục đưa ảnh biến thể này vào ngữ cảnh câu lệnh tiếp theo
            await flow.addLatestTileToPrompt(page); 

            // Bước 6: Đổi chế độ cấu hình sang Video Mode (Chọn Omni Flash, độ dài 10s) và nạp prompt video
            await flow.configureAndFillVideoPrompt(page, PROMPT_TEXT_VIDEO);

            // Bước 7: Thống kê số lượng video hiện diện trước khi bấm sinh để chặn lỗi bất đồng bộ
            const currentVideoCount = await page.locator('video').count();
            console.log(`Báo cáo số lượng: Đang tồn tại ${currentVideoCount} video trên màn hình.`);
            await flow.submitPrompt(page);

            // Bước 8-10: Đợi quá trình render xử lý video hoàn chỉnh và tải file .mp4 về thư mục đích
            const paddedNumber = String(i).padStart(3, '0');
            const baseNameWithIndex = `${config.BASE_FILE_NAME}_${paddedNumber}`;
            const finalFilePath = utils.getUniqueFilePath(config.OUTPUT_DIR, baseNameWithIndex, '.mp4');

            await flow.downloadLatestVideo(page, currentVideoCount, finalFilePath);
            console.log(`✅ KẾT THÚC VÒNG LẶP ${i}: Tải file thành công!\n   📁 Vị trí: ${finalFilePath}`);
            
            await page.waitForTimeout(config.DELAY_MEDIUM);

        } catch (error) {
            console.error(`\n❌ Cảnh báo lỗi nghiêm trọng tại vòng lặp thứ ${i}:`, error.message);
            console.log('⏳ Tiến hành bỏ qua trạng thái lỗi hiện tại, giải phóng menu và chuyển sang vòng tiếp theo...');
            await page.keyboard.press('Escape'); 
            await page.waitForTimeout(1000);
        }
    }

    console.log('\n🎉 [HOÀN THÀNH] Toàn bộ chuỗi tiến trình tự động hóa kết thúc tốt đẹp!');
    process.exit(0);
})();