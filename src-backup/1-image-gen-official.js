const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ==========================================
// CẤU HÌNH CHUNG
// ==========================================
const TEST_IMAGE = path.resolve(__dirname, 'sample.jpeg'); 
const PROMPT_FILE = path.resolve(__dirname, 'prompt/current_prompt_img.txt');
const LOOP_COUNT = 3; // Số lần chạy lặp

// ================= CẤU HÌNH DOWNLOAD =================
const OUTPUT_DIR = path.resolve(__dirname, 'output_images'); 
const BASE_FILE_NAME = '2k_image'; 

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

// Tạo thư mục nếu nó chưa tồn tại
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
    console.log(`📂 Đã tạo thư mục lưu trữ: ${OUTPUT_DIR}`);
}

// Đọc nội dung prompt từ file txt
let PROMPT_TEXT = "";
try {
    PROMPT_TEXT = fs.readFileSync(PROMPT_FILE, 'utf8').trim(); 
    if (!PROMPT_TEXT) {
        console.log('❌ File prompt.txt đang trống! Vui lòng nhập nội dung.');
        process.exit();
    }
} catch (error) {
    console.log('❌ Không tìm thấy file prompt.txt! Vui lòng tạo file cùng thư mục.');
    process.exit();
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
    let page = context.pages().find(p => p.url().toLowerCase().includes('labs.google'));
    
    if (!page) {
        console.log('❌ Không tìm thấy tab Google Labs hợp lệ.');
        process.exit();
        return;
    }

    console.log(`🎯 Đã nhắm trúng tab: "${await page.title()}"`);
    console.log(`📝 Nội dung prompt: "${PROMPT_TEXT}"\n`);

    // ==========================================
    // BẮT ĐẦU VÒNG LẶP
    // ==========================================
    for (let i = 1; i <= LOOP_COUNT; i++) {
        console.log(`\n==========================================`);
        console.log(`🚀 BẮT ĐẦU VÒNG LẶP THỨ ${i}/${LOOP_COUNT}`);
        console.log(`==========================================`);

        try {
            // ==========================================
            // BƯỚC 1: ĐÍNH KÈM ẢNH TỪ MÁY TÍNH
            // ==========================================
            console.log('👉 1. Đang mở menu và đính kèm ảnh...');
            const plusBtn = page.locator('button:has(i:text-is("add_2"))').first();
            await plusBtn.waitFor({ state: 'visible', timeout: 5000 });
            await plusBtn.click();
            
            const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                page.locator('text="Tải nội dung nghe nhìn lên"').last().click()
            ]);
            
            await fileChooser.setFiles(TEST_IMAGE);

            console.log('   ⏳ Đợi 5s để file ảnh thực sự load vào khung...');
            await page.waitForTimeout(5000); 

            // ==========================================
            // BƯỚC 2: ĐIỀN PROMPT
            // ==========================================
            console.log('👉 2. Điền prompt...');
            const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
            await chatBox.waitFor({ state: 'visible', timeout: 5000 });
            await chatBox.click();
            await chatBox.fill(PROMPT_TEXT);
            await page.waitForTimeout(5000);
            
            // ==========================================
            // BƯỚC 3: THÊM ẢNH CŨ VÀO CÂU LỆNH
            // ==========================================
            console.log('👉 3. Đang giám sát ô ảnh mới nhất để Thêm vào câu lệnh...');
            const tileBoxPrompt = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
            const imgPrompt = tileBoxPrompt.locator('img[alt="Hình ảnh được tạo"]');
            
            await imgPrompt.waitFor({ state: 'visible', timeout: 120000 });
            await page.waitForTimeout(2000); 
            await imgPrompt.hover({ force: true });
            await page.waitForTimeout(1000); 

            console.log('   Đang định vị nút 3 chấm...');
            const visibleToolbar1 = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtn1 = visibleToolbar1.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtn1.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtn1.hover({ force: true });
            await page.waitForTimeout(500); 
            await threeDotsBtn1.click({ force: true });
            await page.waitForTimeout(1000); 

            console.log('   Đang chọn "Thêm vào câu lệnh"...');
            const addToPromptMenu = page.locator('text="Thêm vào câu lệnh"').last();
            await addToPromptMenu.waitFor({ state: 'visible', timeout: 5000 });
            await addToPromptMenu.click({ force: true });
            await page.waitForTimeout(1000);

            // ==========================================
            // BƯỚC 4: BẤM GỬI (TẠO ẢNH MỚI)
            // ==========================================
            console.log('👉 4. Đang bấm nút Gửi để AI tạo ảnh...');
            const sendBtn = page.locator('button:has(i:text-is("arrow_forward"))').first();
            await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
            await sendBtn.click();
            
            // Chờ 2s để giao diện chuyển sang trạng thái load (%)
            await page.waitForTimeout(2000);

            // ==========================================
            // BƯỚC 5: CHỜ ẢNH MỚI XONG VÀ HOVER VÀO NÚT 3 CHẤM
            // ==========================================
            console.log('👉 5. Đang chờ ảnh MỚI NHẤT tạo xong để Tải xuống...');
            const tileBoxDownload = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
            const imgDownload = tileBoxDownload.locator('img[alt="Hình ảnh được tạo"]');
            
            await imgDownload.waitFor({ state: 'visible', timeout: 120000 });
            console.log('✅ Ảnh đã tạo xong! Bắt đầu tiến trình tải xuống...');
            await page.waitForTimeout(3000);
            
            await imgDownload.hover(); // Dùng chuẩn hover thường
            await page.waitForTimeout(1000); 

            const visibleToolbar2 = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtn2 = visibleToolbar2.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtn2.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtn2.hover();
            await page.waitForTimeout(500); 
            await threeDotsBtn2.click();
            await page.waitForTimeout(1000); 

            // ==========================================
            // BƯỚC 6: HOVER TẢI XUỐNG VÀ CLICK 2K (CHUẨN GỐC)
            // ==========================================
            console.log('👉 6. Đang hover vào mục "Tải xuống"...');
            const downloadMenu = page.locator('text="Tải xuống"').last();
            await downloadMenu.waitFor({ state: 'visible', timeout: 5000 });
            await downloadMenu.hover();
            await page.waitForTimeout(1000);

            console.log(`👉 7. Đang bấm tải 2K và xử lý file...`);
            const resolution2K = page.getByText('2K', { exact: true }).last();
            await resolution2K.waitFor({ state: 'visible', timeout: 5000 });

            // Dùng Promise.all nguyên bản như bạn yêu cầu
            const [download] = await Promise.all([
                page.waitForEvent('download'), 
                resolution2K.click()           
            ]);

            // Format tên file chống ghi đè: cr7_2k_image_001.jpg
            const paddedNumber = String(i).padStart(3, '0');
            const baseNameForThisLoop = `${BASE_FILE_NAME}_${paddedNumber}`;
            const finalFilePath = getUniqueFilePath(OUTPUT_DIR, baseNameForThisLoop, '.jpg');

            await download.saveAs(finalFilePath);
            console.log(`✅ TẢI THÀNH CÔNG VÒNG ${i}! File lưu tại:\n   📁 ${finalFilePath}`);
            
            // Nghỉ một chút trước khi reset lại vòng tiếp theo
            await page.waitForTimeout(3000);

        } catch (error) {
            console.error(`\n❌ Thất bại hoàn toàn tại vòng ${i}:`, error.message);
            console.log('⏳ Bỏ qua và tiếp tục chạy vòng tiếp theo...');
            // Nhấn ESC phòng trường hợp menu bị kẹt mở ở vòng trước
            await page.keyboard.press('Escape'); 
            await page.waitForTimeout(1000);
        }
    }

    console.log('\n🎉 ĐÃ HOÀN THÀNH TOÀN BỘ VÒNG LẶP!');
    process.exit();
})();