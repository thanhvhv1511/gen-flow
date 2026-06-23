const fs = require('fs');
const path = require('path');

/**
 * Kiểm tra và sinh ra đường dẫn file duy nhất chống ghi đè
 */
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

/**
 * Đảm bảo thư mục chỉ định luôn tồn tại
 */
function ensureDirExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📂 Đã tạo thư mục lưu trữ: ${dir}`);
    }
}

/**
 * Đọc và kiểm tra nội dung tệp tin prompt chữ
 */
function readPromptFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8').trim(); 
        if (!content) {
            console.error(`❌ Tệp tin ${filePath} rỗng! Vui lòng bổ sung nội dung.`);
            process.exit(1);
        }
        return content;
    } catch (error) {
        console.error(`❌ Không tìm thấy tệp tin: ${filePath}`);
        process.exit(1);
    }
}

module.exports = {
    getUniqueFilePath,
    ensureDirExists,
    readPromptFile
};