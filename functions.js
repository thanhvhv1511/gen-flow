// functions.js - File chứa các hàm đang dev, test độc lập

// Hằng số delay để thao tác mượt mà hơn
const DELAY_SHORT = 500;

// Biến toàn cục trong module này để ghi nhớ ID của ảnh gốc (Reference Image)
let referenceTileId = null;

/**
 * Hàm thêm ảnh mẫu (Reference Image) vào câu lệnh prompt
 * Quét vòng đầu để ghim ID, các vòng sau gọi lại bằng ID
 * @param {Object} page - Đối tượng Page của Playwright
 * @returns {Promise<string>} ID của ảnh mẫu (để đưa vào whitelist bỏ qua khi tải/xóa)
 */
async function addUploadedTileToPrompt(page) {
    console.log('👉 Đang xử lý ảnh mẫu (Reference Image) để Thêm vào câu lệnh...');
    let tileBoxPrompt;

    // Phân nhánh logic theo vòng lặp
    if (!referenceTileId) {
        // [Vòng 1] Quét ô đầu tiên và lưu ID lại
        tileBoxPrompt = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
        referenceTileId = await tileBoxPrompt.getAttribute('data-tile-id');
        console.log(`   [Vòng 1] Đã ghim ID ảnh mẫu: ${referenceTileId}`);
    } else {
        // [Vòng 2 trở đi] Gọi đích danh ảnh gốc bằng ID đã lưu
        console.log(`   [Vòng 2+] Khóa mục tiêu ảnh mẫu theo ID: ${referenceTileId}`);
        tileBoxPrompt = page.locator(`div[data-tile-id="${referenceTileId}"]`).first();
    }
    
    try {
        // Giải phóng không gian, đóng các menu dropdown còn kẹt
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500); 
    } catch (e) {}

    const imgPrompt = tileBoxPrompt.locator('img[alt="Hình ảnh được tạo"]');
    
    await imgPrompt.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(DELAY_SHORT); 
    
    console.log('   Đang định vị nút 3 chấm...');
    // Cuộn tới ảnh phòng trường hợp bị trôi khỏi khung nhìn
    // 2. 🎯 TUNG CHIÊU: GIẢ LẬP DI CHUỘT VẬT LÝ THEO TỌA ĐỘ
    const box = await tileBoxPrompt.boundingBox();
    if (box) {
        // Di chuyển chuột ra tọa độ (0,0) ở góc màn hình trước để "reset" trạng thái
        await page.mouse.move(0, 0); 
        await page.waitForTimeout(300);
        
        // Di chuột vật lý vào chính giữa khung ảnh (x + 1/2 rộng, y + 1/2 cao)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
        await page.waitForTimeout(500);
        
        // Bắn thêm các Event ở mức DOM để đảm bảo đánh thức UI (phòng hờ)
        await tileBoxPrompt.dispatchEvent('mouseenter');
        await tileBoxPrompt.dispatchEvent('mouseover');
        await tileBoxPrompt.dispatchEvent('pointerenter');
    } else {
        // Phương án dự phòng nếu DOM bị lỗi không lấy được tọa độ
        await tileBoxPrompt.hover({ force: true });
        await imgPrompt.hover({ force: true });
    }
    
    await page.waitForTimeout(1000); // Đợi 1s cho animation của Toolbar trượt ra

    const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
    const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
    
    await threeDotsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await threeDotsBtn.hover({ force: true });
    await page.waitForTimeout(DELAY_SHORT); 
    await threeDotsBtn.click({ force: true });
    await page.waitForTimeout(DELAY_SHORT); 

    console.log('   Kích hoạt: "Thêm vào câu lệnh"...');
    await page.locator('text="Thêm vào câu lệnh"').last().click({ force: true });
    await page.waitForTimeout(DELAY_SHORT);

    // Trả về ID để dùng cho các hàm khác (như hàm xóa)
    return referenceTileId; 
}


/**
 * Hàm Tải và Xóa ảnh liên tục (Quét Radar, tải xong xóa ngay)
 * @param {Object} page - Đối tượng Page của Playwright
 * @param {Function} getFilePathCallback - Hàm callback sinh tên file động
 * @param {number} expectedCount - Số lượng ảnh cần tải (Mặc định: 4)
 * @param {number} maxTimeout - Thời gian đợi tối đa (Mặc định: 3 phút)
 * @param {string} ignoreTileId - ID của ảnh gốc không được phép tải/xóa
 */
async function downloadAndDeleteImages(page, getFilePathCallback, expectedCount = 4, maxTimeout = 180000, ignoreTileId = null) {
    console.log(`👉 Đang giám sát khung kết quả, sẵn sàng tải và dọn dẹp ${expectedCount} ảnh...`);
    
    // Tăng vùng quét lên +1 vì có thể quét trúng ảnh gốc (bị skip)
    const scanLimit = ignoreTileId ? expectedCount + 1 : expectedCount;

    const startTime = Date.now();
    let downloadedCount = 0; 

    // Vòng lặp radar quét liên tục
    while (Date.now() - startTime < maxTimeout) {
        // Đủ KPI thì thoát
        if (downloadedCount >= expectedCount) {
            console.log(`✅ Đã tải và dọn dẹp trọn vẹn ${expectedCount} khung ảnh!`);
            return true; 
        }

        // Quét các ô đầu tiên trên cùng
        for (let j = 0; j < scanLimit; j++) {
            if (downloadedCount >= expectedCount) break;

            // Quét tìm div có data-tile-id
            const currentTile = page.locator('div[data-tile-id]').nth(j);
            if (await currentTile.count() === 0) continue;

            // Lấy ID của khung hiện tại
            const tileId = await currentTile.getAttribute('data-tile-id');

            // 🛡️ BƯỚC KIỂM TRA QUAN TRỌNG: Nếu trùng ID ảnh mẫu thì bỏ qua ngay lập tức
            if (ignoreTileId && tileId === ignoreTileId) {
                continue;
            }

            const imgElement = currentTile.locator('img[alt="Hình ảnh được tạo"]');
            
            // Nếu ảnh đã render và hiển thị
            if (await imgElement.count() > 0 && await imgElement.isVisible()) {
                console.log(`\n⏳ Ảnh ở Khung (ID: ${tileId}) đã nặn xong! Tiến hành tải...`);
                
                // 🎯 Tạo locator cố định theo ID, bất chấp DOM bị xô lệch
                const exactTile = page.locator(`div[data-tile-id="${tileId}"]`).first();
                const exactImg = exactTile.locator('img[alt="Hình ảnh được tạo"]').first();

                try {
                    // Giải phóng không gian, đóng các menu dropdown còn kẹt
                    await page.keyboard.press('Escape');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(500); 
                } catch (e) {}

                try {
                    // --- HÀNH ĐỘNG 1: TẢI XUỐNG ---
                    await exactTile.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500);
                    await exactTile.hover();
                    await page.waitForTimeout(500);
                    await exactImg.hover({ force: true });
                    await page.waitForTimeout(500);

                    const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
                    const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
                    
                    await threeDotsBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await threeDotsBtn.click({ force: true });
                    await page.waitForTimeout(500);

                    await page.locator('text="Tải xuống"').last().hover();
                    await page.waitForTimeout(500);

                    const resolution2K = page.getByText('1K', { exact: true }).last();
                    await resolution2K.waitFor({ state: 'visible', timeout: 5000 });

                    // Lấy đường dẫn file thông qua callback truyền từ file chính
                    const finalFilePath = getFilePathCallback(downloadedCount);

                    const [download] = await Promise.all([
                        page.waitForEvent('download', { timeout: 30000 }), 
                        resolution2K.click()           
                    ]);

                    await download.saveAs(finalFilePath);
                    console.log(`   ✅ Đã tải thành công -> 📁 ${finalFilePath}`);
                    
                    downloadedCount++;

                    // Đóng Toast thông báo nếu có
                    try {
                        const toastCloseBtn = page.locator('li[data-sonner-toast] button:has-text("Đóng")').first();
                        await toastCloseBtn.waitFor({ state: 'visible', timeout: 3000 });
                        await toastCloseBtn.click();
                        await page.waitForTimeout(500);
                    } catch (e) {}

                    // --- HÀNH ĐỘNG 2: XÓA ẢNH ĐỂ DỌN CHỖ ---
                    console.log(`   🗑️ Đang tiến hành xóa ảnh...`);
                    // Hover lại vào ĐÚNG ID ảnh vừa tải
                    await exactImg.hover({ force: true });
                    await page.waitForTimeout(500);
                    
                    // Quét lại Toolbar mới do cái cũ đã bị đóng
                    const newVisibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
                    const newThreeDotsBtn = newVisibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
                    
                    await newThreeDotsBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await newThreeDotsBtn.click({ force: true });
                    await page.waitForTimeout(500);

                    const deleteBtn = page.locator('text="Xoá"').or(page.locator('text="Chuyển vào thùng rác"')).last();
                    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await deleteBtn.click({ force: true });
                    console.log(`   ✅ Đã phi tang ảnh vào thùng rác!`);
                    
                    // Chờ DOM cập nhật và ảnh dưới bị đẩy lên
                    await page.waitForTimeout(1000); 

                    // Break vòng lặp FOR để radar quay lại quét từ Khung đầu tiên
                    break; 

                } catch (error) {
                    console.error(`   ⚠️ Tương tác tải/xóa bị lỗi: ${error.message}`);
                    console.log('   -> Sẽ thử lại ở vòng quét tiếp theo.');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(1000);
                }
            }
        }

        // Nghỉ ngơi giữa các lần quét radar
        await page.waitForTimeout(1500);
    }

    // Nếu hết giờ mà chưa tải đủ KPI
    if (downloadedCount < expectedCount) {
        console.log('\n⏰ ĐÃ HẾT TIMEOUT!');
        console.log(`Chỉ dọn dẹp được ${downloadedCount}/${expectedCount} ảnh. Chuyển sang tiến trình khác...`);
        await page.keyboard.press('Escape'); 
        return false;
    }
}

module.exports = {
    downloadAndDeleteImages,
    addUploadedTileToPrompt
};