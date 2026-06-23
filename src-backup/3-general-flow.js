const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ==========================================
// CẤU HÌNH CHUNG
// ==========================================
const TEST_IMAGE = path.resolve(__dirname, 'sample.jpeg'); 
const PROMPT_FILE_IMAGE = path.resolve(__dirname, 'prompt-img.txt');
const PROMPT_FILE_VIDEO = path.resolve(__dirname, 'prompt-video.txt');
const LOOP_COUNT = 3; // Số lần chạy lặp

// ==========================================
// CẤU HÌNH THỜI GIAN CHỜ (Đặt ở đầu file)
// ==========================================
const DELAY_SHORT = 100;
const DELAY_MEDIUM = 2000;
const DELAY_LONG = 5000;


// ================= CẤU HÌNH DOWNLOAD =================
const OUTPUT_DIR = path.resolve(__dirname, 'output_images'); 
const BASE_FILE_NAME = 'cr7_1080_video'; // Đổi tên gốc cho hợp lý với video

// ==========================================
// CẤU HÌNH MÔ HÌNH MUỐN CHỌN
// ==========================================
const TARGET_MODEL = 'Nano Banana 2'; // Bạn có thể đổi thành 'Nano Banana 2 or Nano Banana Pro'

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
let PROMPT_TEXT_IMAGE = "";
try {
    PROMPT_TEXT_IMAGE = fs.readFileSync(PROMPT_FILE_IMAGE, 'utf8').trim(); 
    if (!PROMPT_TEXT_IMAGE) {
        console.log(`❌ File ${PROMPT_FILE_IMAGE} đang trống! Vui lòng nhập nội dung.`);
        process.exit();
    }
} catch (error) {
    console.log(`❌ Không tìm thấy file ${PROMPT_FILE_IMAGE}! Vui lòng tạo file cùng thư mục.`);
    process.exit();
}

// Đọc nội dung prompt từ file txt
let PROMPT_TEXT_VIDEO = "";
try {
    PROMPT_TEXT_VIDEO = fs.readFileSync(PROMPT_FILE_VIDEO, 'utf8').trim(); 
    if (!PROMPT_TEXT_VIDEO) {
        console.log(`❌ File ${PROMPT_FILE_VIDEO} đang trống! Vui lòng nhập nội dung.`);
        process.exit();
    }
} catch (error) {
    console.log(`❌ Không tìm thấy file ${PROMPT_FILE_VIDEO}! Vui lòng tạo file cùng thư mục.`);
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
    
        // Lấy context đầu tiên từ trình duyệt đang mở
    const context = browser.contexts()[0];
    let page = context.pages()[0]; // Lấy tạm tab đầu tiên để điều hướng

    if (!page) {
        console.log('💡 Không có tab nào đang mở, tiến hành mở tab mới...');
        page = await context.newPage();
    }

    try {
        const currentUrl = page.url();
        console.log(`🌐 URL hiện tại: ${currentUrl}`);

        // TRƯỜNG HỢP 1: Đang ở sẵn trong một dự án (URL chứa '/project/')
        if (currentUrl.includes('/tools/flow/project/')) {
            console.log('⚡ Đang ở sẵn trong dự án. Bỏ qua bước điều hướng và tạo mới.');
        } 
        // TRƯỜNG HỢP 2 & 3: Chưa vào dự án
        else {
            // Nếu chưa ở trang chủ Flow thì mới cần điều hướng (Trường hợp 3)
            if (!currentUrl.includes('/tools/flow')) {
                console.log('🌐 Đang điều hướng tới Google Labs Flow...');
                await page.goto('https://labs.google/fx/vi/tools/flow', { waitUntil: 'domcontentloaded' });
            } else {
                console.log('⚡ Đang ở sẵn trang chủ Flow, không cần load lại trang.');
            }

            // Click vào nút "Dự án mới" (Áp dụng cho cả TH 2 và 3)
            console.log('👉 Đang tìm và click nút "Dự án mới"...');
            const newProjectBtn = page.locator('button:has-text("Dự án mới"), [role="button"]:has-text("Dự án mới")').first();
            await newProjectBtn.waitFor({ state: 'visible', timeout: 15000 });
            await newProjectBtn.click();
            console.log('🎉 Đã click thành công nút "Dự án mới"!');
        }

    } catch (error) {
        console.error('❌ Có lỗi xảy ra trong quá trình thiết lập trạng thái trang:', error.message);
    }

    // ==========================================
    // BƯỚC ĐỆM: CHỜ WORKSPACE KHỞI TẠO XONG
    // ==========================================
    console.log('⏳ Đang chờ không gian làm việc khởi tạo...');
    const chatBoxInit = page.locator('div[role="textbox"]').first();
    await chatBoxInit.waitFor({ state: 'visible', timeout: 30000 }); 
    await page.waitForTimeout(DELAY_MEDIUM);
    console.log('✅ Giao diện dự án đã sẵn sàng! Bắt đầu vòng lặp...');

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
            await page.waitForTimeout(DELAY_LONG); 

            // ==========================================
            // BƯỚC 2: ĐIỀN PROMPT TẠO ẢNH
            // ==========================================
            // 1. Promt
            console.log('👉 2. Điền prompt tạo ảnh...');
            const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
            await chatBox.waitFor({ state: 'visible', timeout: 5000 });
            await chatBox.click();
            // Lần nhập đầu tiên dùng fill được vì khung chat chưa có gì
            await chatBox.fill(PROMPT_TEXT_IMAGE); 
            await page.waitForTimeout(DELAY_MEDIUM);

            // 2. MỞ MENU CẤU HÌNH 
            console.log('👉 Đang tìm và click nút cấu hình mô hình...');
            
            // Cập nhật Regex để bắt được cả "Nano Banana Pro"
            const configBtn = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Banana|Nano|Video/i }).first();
            await configBtn.waitFor({ state: 'visible', timeout: 10000 });
            await configBtn.click({ force: true });
            
            console.log('⏳ Đang chờ menu bung ra...');
            const menuContainer = page.locator('[role="menu"], [data-radix-menu-content]').last();
            await menuContainer.waitFor({ state: 'visible', timeout: 10000 });
            
            console.log('✅ Menu đã mở thành công!');
            
            // 3.1. Chọn tab "Hình ảnh"
            console.log('👉 Chọn tab Hình ảnh...');
            const imageTab = menuContainer.locator('button[role="tab"]:has-text("Hình ảnh")').first();
            await imageTab.waitFor({ state: 'visible', timeout: 5000 });
            await imageTab.click();
            await page.waitForTimeout(100);

            // 3.2. Chọn khung hình "9:16"
            console.log('👉 Chọn khung hình 9:16...');
            const ratioBtn = menuContainer.locator('button[role="tab"]:has-text("9:16")').first();
            await ratioBtn.click();
            await page.waitForTimeout(100);

            // 3.3. Chọn số lượng "1x"
            console.log('👉 Chọn số lượng 1x...');
            const quantityBtn = menuContainer.locator('button[role="tab"]:text-is("1x")').first();
            await quantityBtn.click();
            await page.waitForTimeout(100);

            // 3.4. Kiểm tra và chọn model linh hoạt theo cấu hình
            console.log(`👉 Kiểm tra và chọn mô hình: ${TARGET_MODEL}...`);
            const modelDropdown = menuContainer.locator('button[aria-haspopup="menu"]').first();
            
            if (await modelDropdown.isVisible()) {
                const currentModelText = await modelDropdown.innerText();
                // Nếu chưa phải mô hình mục tiêu thì mới click chọn lại
                if (!currentModelText.includes(TARGET_MODEL)) {
                    await modelDropdown.click();
                    await page.waitForTimeout(100);
                    
                    const modelOption = page.locator('button, [role="menuitem"], [role="option"]').filter({ hasText: TARGET_MODEL }).last();
                    await modelOption.click();
                }
            }
            await page.waitForTimeout(100);
            
            // 4. ĐÓNG MENU 
            console.log('👉 Đang đóng menu...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            console.log('\n🎉 ĐÃ CẤU HÌNH CHUYỂN ĐỔI SANG TẠO HÌNH ẢNH THÀNH CÔNG!');
            
            // ==========================================
            // BƯỚC 3: THÊM ẢNH CŨ VÀO CÂU LỆNH
            // ==========================================
            console.log('👉 3. Đang giám sát ô ảnh mới nhất để Thêm vào câu lệnh...');
            const tileBoxPrompt = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
            const imgPrompt = tileBoxPrompt.locator('img[alt="Hình ảnh được tạo"]');
            
            await imgPrompt.waitFor({ state: 'visible', timeout: 120000 });
            await page.waitForTimeout(DELAY_SHORT); 
            await imgPrompt.hover({ force: true });
            await page.waitForTimeout(DELAY_SHORT); 

            console.log('   Đang định vị nút 3 chấm...');
            const visibleToolbar1 = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtn1 = visibleToolbar1.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtn1.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtn1.hover({ force: true });
            await page.waitForTimeout(DELAY_SHORT); 
            await threeDotsBtn1.click({ force: true });
            await page.waitForTimeout(DELAY_SHORT); 

            console.log('   Đang chọn "Thêm vào câu lệnh"...');
            const addToPromptMenu = page.locator('text="Thêm vào câu lệnh"').last();
            await addToPromptMenu.waitFor({ state: 'visible', timeout: 5000 });
            await addToPromptMenu.click({ force: true });
            await page.waitForTimeout(DELAY_SHORT);

            // ==========================================
            // BƯỚC 4: BẤM GỬI (TẠO ẢNH MỚI)
            // ==========================================
            console.log('👉 4. Đang bấm nút Gửi để AI tạo ảnh...');
            const sendBtn = page.locator('button:has(i:text-is("arrow_forward"))').first();
            await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
            await sendBtn.click();
            
            await page.waitForTimeout(DELAY_LONG);

            // ==========================================
            // BƯỚC 5: CHỜ ẢNH MỚI XONG VÀ THÊM VÀO CÂU LỆNH
            // ==========================================
            console.log('👉 5. Đang chờ ảnh tạo xong ...');
            const tileBoxNewImg = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
            const newImg = tileBoxNewImg.locator('img[alt="Hình ảnh được tạo"]');
            
            await newImg.waitFor({ state: 'visible', timeout: 120000 });
            console.log('✅ Ảnh đã tạo xong! Dùng ảnh này để tạo video..');
            await page.waitForTimeout(DELAY_SHORT);
            
            console.log('   Đang hover ảnh mới để lấy nút 3 chấm...');
            await newImg.hover({ force: true });
            await page.waitForTimeout(DELAY_SHORT); 

            const visibleToolbarNewImg = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtnNewImg = visibleToolbarNewImg.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtnNewImg.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtnNewImg.hover({ force: true });
            await page.waitForTimeout(DELAY_SHORT); 
            await threeDotsBtnNewImg.click({ force: true });
            await page.waitForTimeout(DELAY_SHORT); 

            console.log('   Đang chọn "Thêm vào câu lệnh"...');
            const addToPromptMenu_2 = page.locator('text="Thêm vào câu lệnh"').last();
            await addToPromptMenu_2.waitFor({ state: 'visible', timeout: 5000 });
            await addToPromptMenu_2.click({ force: true });
            await page.waitForTimeout(DELAY_SHORT);

            // ==========================================
            // BƯỚC 6: VIẾT PROMPT VIDEO
            // ==========================================
            console.log('👉 6. Điền prompt video...');
            const chatBox_2 = page.locator('div[contenteditable="true"][role="textbox"]').first();
            await chatBox_2.waitFor({ state: 'visible', timeout: 5000 });
            await chatBox_2.click();
            
            // DÙNG BÀN PHÍM ĐỂ GÕ THAY VÌ .FILL() ĐỂ KHÔNG BỊ XÓA MẤT ẢNH VỪA ĐÍNH KÈM
            await chatBox.fill(PROMPT_TEXT_VIDEO); 
            await page.waitForTimeout(DELAY_SHORT);

            // 2. Update mô hình
            console.log('👉 Đang tìm và click nút cấu hình mô hình...');
            
            const configBtn_2 = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Banana|Nano|Video/i }).first();
            await configBtn_2.waitFor({ state: 'visible', timeout: 10000 });
            await configBtn_2.click({ force: true });
            
            console.log('⏳ Đang chờ menu bung ra...');
            const menuContainer_2 = page.locator('[role="menu"], [data-radix-menu-content]').last();
            await menuContainer_2.waitFor({ state: 'visible', timeout: 10000 });
            
            console.log('✅ Menu đã mở thành công!');

            // 3. THAO TÁC BÊN TRONG MENU 
            
            // 3.1. Chọn tab "Video"
            console.log('👉 Chọn tab Video...');
            const videoTab = menuContainer_2.locator('button[role="tab"]:has-text("Video")').first();
            await videoTab.waitFor({ state: 'visible', timeout: 5000 });
            await videoTab.click();
            await page.waitForTimeout(100);

            // 3.2. Chọn "Thành phần" 
            console.log('👉 Chọn Thành phần...');
            const thanhPhanBtn = menuContainer_2.locator('button[role="tab"]:has-text("Thành phần")').first();
            await thanhPhanBtn.click();
            await page.waitForTimeout(100);

            // 3.3. Chọn khung hình "9:16"
            console.log('👉 Chọn khung hình 9:16...');
            const ratioBtn_2 = menuContainer_2.locator('button[role="tab"]:has-text("9:16")').first();
            await ratioBtn_2.click();
            await page.waitForTimeout(100);

            // 3.4. Chọn số lượng "1x"
            console.log('👉 Chọn số lượng 1x...');
            const quantityBtn_2 = menuContainer_2.locator('button[role="tab"]:text-is("1x")').first();
            await quantityBtn_2.click();
            await page.waitForTimeout(100);

            // 3.5. Kiểm tra và chọn model "Omni Flash"
            console.log('👉 Kiểm tra và chọn Omni Flash...');
            const modelDropdown_2 = menuContainer_2.locator('button[aria-haspopup="menu"]').first();
            
            if (await modelDropdown_2.isVisible()) {
                const currentModelText = await modelDropdown_2.innerText();
                if (!currentModelText.includes("Omni Flash")) {
                    await modelDropdown_2.click();
                    await page.waitForTimeout(100);
                    
                    // ĐÃ FIX LỖI CÚ PHÁP TẠI ĐÂY: Dùng filter để tìm chính xác thẻ chứa chữ Omni Flash
                    const omniOption = page.locator('button, [role="menuitem"], [role="option"]').filter({ hasText: 'Omni Flash' }).last();
                    await omniOption.click();
                }
            }
            await page.waitForTimeout(100);

            // 3.6. Chọn thời lượng "10s"
            console.log('👉 Chọn thời lượng 10s...');
            const duration10sBtn = menuContainer_2.locator('button[role="tab"]:has-text("10s")').first();
            await duration10sBtn.click();
            await page.waitForTimeout(100);
            
            // 4. ĐÓNG MENU 
            console.log('👉 Đang đóng menu...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);

            console.log('\n🎉 ĐÃ CẤU HÌNH CHUYỂN ĐỔI SANG TẠO VIDEO THÀNH CÔNG!');

            // ==========================================
            // BƯỚC 7: BẤM GỬI (TẠO VIDEO MỚI)
            // ==========================================
            // 🎯 TRƯỚC KHI BẤM GỬI: Đếm xem hiện tại đang có bao nhiêu video trên màn hình
            const currentVideoCount = await page.locator('video').count();
            console.log(`Đang có ${currentVideoCount} video`);

            console.log('👉 7. Đang bấm nút Gửi để AI tạo video...');
            const sendBtn_2 = page.locator('button:has(i:text-is("arrow_forward"))').first();
            await sendBtn_2.waitFor({ state: 'visible', timeout: 5000 });
            await sendBtn_2.click();
            
            await page.waitForTimeout(DELAY_LONG);

            // ==========================================
            // BƯỚC 8: CHỜ VIDEO MỚI XONG VÀ HOVER VÀO NÚT 3 CHẤM
            // ==========================================
            console.log('👉 8. Đang chờ VIDEO MỚI NHẤT tạo xong để Tải xuống...');

            // 🎯 ÉP CHỜ: Bắt trình duyệt đứng im cho đến khi số lượng thẻ <video> nhiều hơn lúc nãy
            await page.waitForFunction(
                (old_count) => document.querySelectorAll('video').length > old_count,
                currentVideoCount,
                { timeout: 300000 } // Đợi tối đa 5 phút
            );
            
            console.log('✅ Precheck ok, đang ép hiển thị video...');
            await page.waitForTimeout(DELAY_LONG);

            // 1. Khóa mục tiêu vào khung chứa mới nhất
            const tileBoxVideo = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
            
            // 2. Ép trình duyệt cuộn khung này vào giữa màn hình để trình duyệt kích hoạt render
            await tileBoxVideo.scrollIntoViewIfNeeded();
            await page.waitForTimeout(DELAY_SHORT);

            // 3. Hover vào khung để ép các thành phần bên trong (thẻ video) phải "thức dậy"
            await tileBoxVideo.hover({ force: true });

            // 6. Tìm nút 3 chấm và click bằng JavaScript (bỏ qua kiểm tra hiển thị)
            const visibleToolbarVideo = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtnVideo = visibleToolbarVideo.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtnVideo.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtnVideo.hover({ force: true });
            await page.waitForTimeout(DELAY_SHORT); 
            await threeDotsBtnVideo.click({ force: true });
            await page.waitForTimeout(DELAY_SHORT);

            // ==========================================
            // BƯỚC 9: HOVER TẢI XUỐNG VÀ CLICK 1080
            // ==========================================
            console.log('👉 9. Đang hover vào mục "Tải xuống"...');
            const downloadMenu = page.locator('text="Tải xuống"').last();
            await downloadMenu.waitFor({ state: 'visible', timeout: 5000 });
            await downloadMenu.hover();
            await page.waitForTimeout(DELAY_SHORT);

            console.log(`👉 10. Đang bấm tải 1080p và xử lý file...`);
            // Dùng getByText('1080') thay vì getByText('1080', { exact: true }) để bắt cả trường hợp có chữ "1080p"
            const resolution1080 = page.getByText(/1080/i).last();
            await resolution1080.waitFor({ state: 'visible', timeout: 5000 });

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 300000 }), 
                resolution1080.click({ force: true })           
            ]);

            // SỬA LỖI Ở ĐÂY: Đổi đuôi file thành .mp4
            const paddedNumber = String(i).padStart(3, '0');
            const baseNameForThisLoop = `${BASE_FILE_NAME}_${paddedNumber}`;
            const finalFilePath = getUniqueFilePath(OUTPUT_DIR, baseNameForThisLoop, '.mp4');

            await download.saveAs(finalFilePath);
            console.log(`✅ TẢI THÀNH CÔNG VÒNG ${i}! File lưu tại:\n   📁 ${finalFilePath}`);
            
            await page.waitForTimeout(DELAY_MEDIUM);

        } catch (error) {
            console.error(`\n❌ Thất bại hoàn toàn tại vòng ${i}:`, error.message);
            console.log('⏳ Bỏ qua và tiếp tục chạy vòng tiếp theo...');
            await page.keyboard.press('Escape'); 
            await page.waitForTimeout(1000);
        }
    }

    console.log('\n🎉 ĐÃ HOÀN THÀNH TOÀN BỘ VÒNG LẶP!');
    process.exit();
})();