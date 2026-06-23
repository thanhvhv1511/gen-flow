// functions.js - File chứa các hàm đang dev, test độc lập

/**
 * Hàm custom: Đính kèm ảnh (Nhận đường dẫn động từ tham số)
 */
async function uploadInitialImageCustom(page, filePath) {
    console.log('👉 1. Đang mở menu và đính kèm ảnh (Hàm dev)...');
    const plusBtn = page.locator('button:has(i:text-is("add_2"))').first();
    await plusBtn.waitFor({ state: 'visible', timeout: 5000 });
    await plusBtn.click();
    
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('text="Tải nội dung nghe nhìn lên"').last().click()
    ]);
    
    await fileChooser.setFiles(filePath);
    console.log(`   ⏳ Đợi 5s để tệp tin ảnh load xong...`);
    await page.waitForTimeout(5000); 
}

/**
 * Hàm mới: Tải ảnh 2K với cơ chế Retry
 */
async function downloadLatestImage(page, targetPath, maxRetries = 3) {
    console.log('👉 Đang giám sát trạng thái render ảnh mới (Hàm dev)...');
    
    const tileBox = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
    const imgElement = tileBox.locator('img[alt="Hình ảnh được tạo"]');
    await imgElement.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(3000);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await imgElement.hover();
            await page.waitForTimeout(1000); 

            const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtn.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtn.hover();
            await page.waitForTimeout(500); 
            await threeDotsBtn.click();
            await page.waitForTimeout(1000); 

            await page.locator('text="Tải xuống"').last().hover();
            await page.waitForTimeout(1000);

            const resolution2K = page.getByText('2K', { exact: true }).last();
            await resolution2K.waitFor({ state: 'visible', timeout: 5000 });

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 60000 }), 
                resolution2K.click()           
            ]);

            await download.saveAs(targetPath);
            return; 
            
        } catch (error) {
            console.error(`   ⚠️ Lần thử ${attempt} thất bại: ${error.message}`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(2000); 
            if (attempt === maxRetries) throw new Error("Tải ảnh thất bại sau 3 lần thử.");
        }
    }
}

module.exports = {
    uploadInitialImageCustom,
    downloadLatestImage
};