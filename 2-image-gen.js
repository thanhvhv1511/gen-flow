const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// --- CÁC MODULE CHỨA HÀM ---
const flowActions = require('./flowActions'); 
const devFuncs = require('./functions');      
const promptBuilder = require('./prompt/promptBuilder'); 

// ==========================================
// 1. CẤU HÌNH TOOL PLAYWRIGHT TẠO ẢNH
// ==========================================
const TEST_IMAGE = path.resolve(__dirname, 'sample.jpeg'); 
const OUTPUT_DIR = path.resolve(__dirname, 'output_images'); 
const BASE_FILE_NAME = '2k_image'; 
const LOOP_COUNT = 3; 

// ==========================================
// 2. CẤU HÌNH CONCEPT PROMPT
// ==========================================
const FILE_OUTPUT_IMAGE = path.join(__dirname, 'prompt', 'current_prompt_img.txt');
const ID_CONCEPT_CAN_CHAY = 1; 
let PROMPT_TEXT = "";

// Hàm chống ghi đè file
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

(async () => {
    // -----------------------------------------------------------------
    // BƯỚC 1: KẾT NỐI CHROME VÀ CHẠY TOOL
    // -----------------------------------------------------------------
    console.log(`\n🔗 Đang khởi động tiến trình tạo ảnh trên Chrome...`);
    let browser;
    try { 
        browser = await chromium.connectOverCDP('http://localhost:9522'); 
    } catch (e) { 
        console.log('❌ Lỗi kết nối port 9522'); 
        return; 
    }
    
    const context = browser.contexts()[0];
    let page = context.pages().find(p => p.url().toLowerCase().includes('labs.google'));
    
    if (!page) { 
        console.log('⚠️ Không có sẵn tab Google Labs. Đang sử dụng tab hiện tại hoặc tạo tab mới...');
        if (context.pages().length > 0) {
            page = context.pages()[0]; 
        } else {
            page = await context.newPage(); 
        }
    }

    page = await flowActions.handleProjectNavigation(page);

    // ==========================================
    // BƯỚC 1.5: TẢI ẢNH MẪU LÊN (CHỈ CHẠY 1 LẦN)
    // ==========================================
    console.log('\n👉 BƯỚC 1.5: Đang tải ảnh Reference mẫu lên Workspace...');
    await flowActions.uploadInitialImage(page); // Tải 1 lần và dùng cho toàn bộ vòng lặp

    // ==========================================
    // BƯỚC 2: TIẾN HÀNH VÒNG LẶP RENDER VÀ TẢI 4 ẢNH
    // ==========================================
    for (let i = 1; i <= LOOP_COUNT; i++) {
        console.log(`\n==========================================`);
        console.log(`🚀 BẮT ĐẦU VÒNG LẶP THỨ ${i}/${LOOP_COUNT}`);
        console.log(`==========================================`);

        try {
            // ---------------------------------------------------------
            // 1. SINH PROMPT MỚI CHO VÒNG LẶP HIỆN TẠI
            // ---------------------------------------------------------
            console.log('--- 🎲 ĐANG TẠO MỚI KỊCH BẢN PROMPT ---');
            const dataRandom = promptBuilder.generate(ID_CONCEPT_CAN_CHAY);
            
            const imgTemplateText = promptBuilder.loadTemplate(dataRandom.imageTemplateFile);
            PROMPT_TEXT = promptBuilder.buildPromptText(imgTemplateText, dataRandom, 'image');
            promptBuilder.overwritePromptFile(FILE_OUTPUT_IMAGE, PROMPT_TEXT);

            console.log(`• Concept:     [${dataRandom.conceptName}]`);
            console.log(`• Background:  ${dataRandom.selectedBgName}`);
            if (dataRandom.selectedUpperBody) console.log(`• Thân trên:   ${dataRandom.selectedUpperBody}`);
            if (dataRandom.selectedLeg)       console.log(`• Dáng chân:   ${dataRandom.selectedLeg}`);
            if (dataRandom.selectedHand)      console.log(`• Dáng tay:    ${dataRandom.selectedHand}`);
            console.log('-------------------------------------------\n');

            // ---------------------------------------------------------
            // 2. GẮN ẢNH VÀO CÂU LỆNH & ĐIỀN PROMPT
            // ---------------------------------------------------------
            // Vì 4 ảnh của vòng trước đã bị xóa, ảnh gốc lại lên vị trí Top 1
            const safeRefTileId = await devFuncs.addUploadedTileToPrompt(page);
            await flowActions.configureAndFillImagePrompt(page, PROMPT_TEXT);

            // ---------------------------------------------------------
            // 3. GỬI LỆNH TẠO ẢNH
            // ---------------------------------------------------------
            // LƯU Ý: Chỗ này bạn có thể thay bằng devFuncs.submitAndWaitByCount(page) nếu muốn xài hàm đếm
            await flowActions.submitPrompt(page);

            // ---------------------------------------------------------
            // 4. QUÉT TẢI XUỐNG VÀ XÓA ẢNH
            // ---------------------------------------------------------
            const paddedLoopNumber = String(i).padStart(3, '0');
            const getFilePathCallback = (downloadIndex) => {
                const baseNameForThisLoop = `${BASE_FILE_NAME}_loop${paddedLoopNumber}_sub${downloadIndex}`;
                return getUniqueFilePath(OUTPUT_DIR, baseNameForThisLoop, '.jpg');
            };

            await devFuncs.downloadAndDeleteImages(page, getFilePathCallback, 4, 180000, safeRefTileId);

            console.log(`\n🎉 HOÀN TẤT TRỌN VẸN VÒNG LẶP THỨ ${i}!`);
            await page.waitForTimeout(2000); // Nghỉ nhẹ lấy sức trước khi xoay vòng mới

        } catch (error) {
            console.error(`\n❌ Lỗi tại vòng ${i}:`, error.message);
            await page.keyboard.press('Escape'); 
            await page.waitForTimeout(2000);
        }
    }

    console.log('\n🎊 HOÀN THÀNH TOÀN BỘ TIẾN TRÌNH!');
    process.exit();
})();