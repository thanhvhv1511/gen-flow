// Khi chu co max retry download

const config = require('./config');

/**
 * Kiểm tra trạng thái URL hiện tại và điều hướng vào workspace
 */
async function handleProjectNavigation(page) {
    const currentUrl = page.url();
    console.log(`🌐 URL hiện tại: ${currentUrl}`);

    if (currentUrl.includes('/tools/flow/project/')) {
        console.log('⚡ Đang ở sẵn trong dự án. Bỏ qua bước điều hướng và tạo mới.');
        return page;
    } 
    
    if (!currentUrl.includes('/tools/flow')) {
        console.log('🌐 Đang điều hướng tới Google Labs Flow...');
        await page.goto('https://labs.google/fx/vi/tools/flow', { waitUntil: 'domcontentloaded' });
    } else {
        console.log('⚡ Đang ở sẵn trang chủ Flow, không cần load lại trang.');
    }

    console.log('👉 Đang tìm và click nút "Dự án mới"...');
    const newProjectBtn = page.locator('button:has-text("Dự án mới"), [role="button"]:has-text("Dự án mới")').first();
    await newProjectBtn.waitFor({ state: 'visible', timeout: 15000 });
    await newProjectBtn.click();
    console.log('🎉 Đã click thành công nút "Dự án mới"!');
    
    return page;
}

/**
 * Đính kèm hình ảnh từ máy tính cục bộ lên workspace
 */
async function uploadInitialImage(page) {
    console.log('👉 1. Đang mở menu và đính kèm ảnh...');
    const plusBtn = page.locator('button:has(i:text-is("add_2"))').first();
    await plusBtn.waitFor({ state: 'visible', timeout: 5000 });
    await plusBtn.click();
    
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('text="Tải nội dung nghe nhìn lên"').last().click()
    ]);
    
    await fileChooser.setFiles(config.TEST_IMAGE);
    console.log(`   ⏳ Đợi ${config.DELAY_LONG / 1000}s để tệp tin ảnh load xong...`);
    await page.waitForTimeout(config.DELAY_LONG);
}

/**
 * Thiết lập cấu hình chuyên sâu và điền prompt tạo Ảnh (Image Mode)
 */
async function configureAndFillImagePrompt(page, promptText) {
    console.log('👉 2. Điền prompt tạo ảnh...');
    const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
    await chatBox.waitFor({ state: 'visible', timeout: 5000 });
    await chatBox.click();
    await chatBox.fill(promptText); 
    await page.waitForTimeout(config.DELAY_MEDIUM);

    console.log('👉 Đang tìm và click nút cấu hình mô hình...');
    const configBtn = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Banana|Nano|Video/i }).first();
    await configBtn.waitFor({ state: 'visible', timeout: 10000 });
    await configBtn.click({ force: true });
    
    console.log('⏳ Đang chờ menu cấu hình bung ra...');
    const menuContainer = page.locator('[role="menu"], [data-radix-menu-content]').last();
    await menuContainer.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log('👉 Chọn tab Hình ảnh...');
    await menuContainer.locator('button[role="tab"]:has-text("Hình ảnh")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn khung hình dọc 9:16...');
    await menuContainer.locator('button[role="tab"]:has-text("9:16")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn số lượng 1x...');
    await menuContainer.locator('button[role="tab"]:text-is("1x")').first().click();
    await page.waitForTimeout(100);

    console.log(`👉 Kiểm tra và chọn mô hình: ${config.TARGET_MODEL}...`);
    const modelDropdown = menuContainer.locator('button[aria-haspopup="menu"]').first();
    if (await modelDropdown.isVisible()) {
        const currentModelText = await modelDropdown.innerText();
        if (!currentModelText.includes(config.TARGET_MODEL)) {
            await modelDropdown.click();
            await page.waitForTimeout(100);
            await page.locator('button, [role="menuitem"], [role="option"]').filter({ hasText: config.TARGET_MODEL }).last().click();
        }
    }
    await page.waitForTimeout(100);
    
    console.log('👉 Đang đóng menu...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
}

/**
 * Định vị thẻ Tile mới nhất ở index 0 và kích hoạt hành động "Thêm vào câu lệnh"
 */
async function addLatestTileToPrompt(page) {
    console.log('👉 Đang giám sát ô phần tử mới nhất để Thêm vào câu lệnh...');
    const tileBoxPrompt = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
    const imgPrompt = tileBoxPrompt.locator('img[alt="Hình ảnh được tạo"]');
    
    await imgPrompt.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(config.DELAY_SHORT); 
    await imgPrompt.hover({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT); 

    const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
    const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
    
    await threeDotsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await threeDotsBtn.hover({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT); 
    await threeDotsBtn.click({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT); 

    console.log('   Kích hoạt: "Thêm vào câu lệnh"...');
    await page.locator('text="Thêm vào câu lệnh"').last().click({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT);
}

/**
 * Nhấp nút gửi câu lệnh kích hoạt AI xử lý thế hệ tài nguyên tiếp theo
 */
async function submitPrompt(page) {
    console.log('👉 Đang bấm nút Gửi để AI sinh nội dung...');
    const sendBtn = page.locator('button:has(i:text-is("arrow_forward"))').first();
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();
    await page.waitForTimeout(config.DELAY_LONG);
}

/**
 * Thiết lập cấu hình nâng cao và nhập prompt tạo Video (Video Mode) với Omni Flash
 */
async function configureAndFillVideoPrompt(page, promptText) {
    console.log('👉 Điền prompt tạo cấu trúc Video...');
    const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
    await chatBox.waitFor({ state: 'visible', timeout: 5000 });
    await chatBox.click();
    await chatBox.fill(promptText); 
    await page.waitForTimeout(config.DELAY_SHORT);

    console.log('👉 Đang tìm và mở menu cấu hình...');
    const configBtn = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Banana|Nano|Video/i }).first();
    await configBtn.waitFor({ state: 'visible', timeout: 10000 });
    await configBtn.click({ force: true });
    
    const menuContainer = page.locator('[role="menu"], [data-radix-menu-content]').last();
    await menuContainer.waitFor({ state: 'visible', timeout: 10000 });

    console.log('👉 Chọn tab Video...');
    await menuContainer.locator('button[role="tab"]:has-text("Video")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn phân loại Thành phần...');
    await menuContainer.locator('button[role="tab"]:has-text("Thành phần")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn khung hình dọc 9:16...');
    await menuContainer.locator('button[role="tab"]:has-text("9:16")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn số lượng 1x...');
    await menuContainer.locator('button[role="tab"]:text-is("1x")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Cấu hình chọn mô hình Omni Flash...');
    const modelDropdown = menuContainer.locator('button[aria-haspopup="menu"]').first();
    if (await modelDropdown.isVisible()) {
        const currentModelText = await modelDropdown.innerText();
        if (!currentModelText.includes("Omni Flash")) {
            await modelDropdown.click();
            await page.waitForTimeout(100);
            await page.locator('button, [role="menuitem"], [role="option"]').filter({ hasText: 'Omni Flash' }).last().click();
        }
    }
    await page.waitForTimeout(100);

    console.log('👉 Chọn giới hạn thời lượng 10s...');
    await menuContainer.locator('button[role="tab"]:has-text("10s")').first().click();
    await page.waitForTimeout(100);
    
    console.log('👉 Đang đóng menu cấu hình...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
}

/**
 * Chờ đợi render Video hoàn chỉnh, xử lý view hiển thị và tải tệp tin độ phân giải 1080p
 */
async function downloadLatestVideo(page, initialVideoCount, targetPath) {
    console.log('👉 8. Đang giám sát trạng thái render tệp tin video mới...');
    await page.waitForFunction(
        (old_count) => document.querySelectorAll('video').length > old_count,
        initialVideoCount,
        { timeout: 300000 }
    );
    
    console.log('✅ Video kết quả đã xuất hiện, kích hoạt render hiển thị...');
    await page.waitForTimeout(config.DELAY_LONG);

    const tileBoxVideo = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
    await tileBoxVideo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(config.DELAY_SHORT);
    await tileBoxVideo.hover({ force: true });

    const visibleToolbarVideo = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
    const threeDotsBtnVideo = visibleToolbarVideo.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
    
    await threeDotsBtnVideo.waitFor({ state: 'visible', timeout: 10000 });
    await threeDotsBtnVideo.hover({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT); 
    await threeDotsBtnVideo.click({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT);

    console.log('👉 Mở rộng menu con "Tải xuống"...');
    await page.locator('text="Tải xuống"').last().hover();
    await page.waitForTimeout(config.DELAY_SHORT);

    console.log(`👉 Thực hiện lệnh tải phiên bản chất lượng cao 1080p...`);
    const resolution1080 = page.getByText(/1080/i).last();
    await resolution1080.waitFor({ state: 'visible', timeout: 5000 });

    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 300000 }), 
        resolution1080.click({ force: true })           
    ]);

    await download.saveAs(targetPath);
}

module.exports = {
    handleProjectNavigation,
    uploadInitialImage,
    configureAndFillImagePrompt,
    addLatestTileToPrompt,
    submitPrompt,
    configureAndFillVideoPrompt,
    downloadLatestVideo
};