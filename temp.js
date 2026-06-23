const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const flowActions = require('./flowActions'); // Các hàm xịn sò đã có (Không đụng chạm)
const devFuncs = require('./functions');      // Các hàm đang dev

// ================= CẤU HÌNH =================
const TEST_IMAGE = path.resolve(__dirname, 'sample.jpeg'); 
const PROMPT_FILE = path.resolve(__dirname, 'prompt-img.txt');
const OUTPUT_DIR = path.resolve(__dirname, 'output_images'); 
const BASE_FILE_NAME = '2k_image'; 
const LOOP_COUNT = 3; 

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

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

let PROMPT_TEXT = "";
try {
    PROMPT_TEXT = fs.readFileSync(PROMPT_FILE, 'utf8').trim(); 
    if (!PROMPT_TEXT) throw new Error("Empty prompt");
} catch (error) {
    console.log('❌ Lỗi file prompt!');
    process.exit();
}

(async () => {
    let browser;
    try { browser = await chromium.connectOverCDP('http://localhost:9522'); } 
    catch (e) { console.log('❌ Lỗi port 9522'); return; }
    
    const context = browser.contexts()[0];
    let page = context.pages().find(p => p.url().toLowerCase().includes('labs.google'));
    
    // Gọi hàm gốc từ flowActions
    page = await flowActions.handleProjectNavigation(page);

    for (let i = 1; i <= LOOP_COUNT; i++) {
        console.log(`\n🚀 BẮT ĐẦU VÒNG LẶP THỨ ${i}/${LOOP_COUNT}`);

        try {
            // Bước 1: Up ảnh - DÙNG HÀM DEV (để truyền file path)
            await devFuncs.uploadInitialImageCustom(page, TEST_IMAGE);

            // Bước 2: Cấu hình image - DÙNG HÀM GỐC
            await flowActions.configureAndFillImagePrompt(page, PROMPT_TEXT);

            // Bước 3: Add vào lệnh - DÙNG HÀM GỐC
            await flowActions.addLatestTileToPrompt(page);

            // Bước 4: Submit - DÙNG HÀM GỐC
            await flowActions.submitPrompt(page);

            // Bước 5 & 6: Tải 2K - DÙNG HÀM DEV
            const paddedNumber = String(i).padStart(3, '0');
            const finalFilePath = getUniqueFilePath(OUTPUT_DIR, `${BASE_FILE_NAME}_${paddedNumber}`, '.jpg');
            
            await devFuncs.downloadLatestImage(page, finalFilePath);
            console.log(`✅ TẢI THÀNH CÔNG VÒNG ${i}!`);

        } catch (error) {
            console.error(`❌ Thất bại vòng ${i}:`, error.message);
            await page.keyboard.press('Escape'); 
            await page.waitForTimeout(1000);
        }
    }
    process.exit();
})();