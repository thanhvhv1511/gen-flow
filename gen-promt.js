const path = require('path');
const promptBuilder = require('./prompt/promptBuilder');

(async () => {
    // Tách biệt file output cho Ảnh và Video để tool đọc song song
    const FILE_OUTPUT_IMAGE = path.join(__dirname, 'prompt', 'current_prompt_img.txt');
    const FILE_OUTPUT_VIDEO = path.join(__dirname, 'prompt', 'current_prompt_video.txt');
    
    // -----------------------------------------------------------------
    // ĐIỀU CHỈNH ID VÀ TÍNH NĂNG Ở ĐÂY
    // -----------------------------------------------------------------
    const ID_CONCEPT_CAN_CHAY = 1; 

    // Cấu hình tính năng sản phẩm (Ví dụ bộ đồ có túi)
    // Nếu bộ đồ bình thường không có gì đặc biệt, chỉ cần để: const FEATURES = [];
    const FEATURES = [
        {
            name: "has_pocket",     // Bắt buộc phải khớp với "requiredFeature" trong file JSON
            mandatory: true,        // true: Ép xuất hiện, false: Có thể xuất hiện hoặc không
            allowedSlots: [2, 3]    // (Tùy chọn) Ép cảnh này chỉ được rớt vào Slot 2 hoặc Slot 3
        }
    ];

    console.log('=== TRÌNH KIỂM TRA PROMPT THEO CONCEPT VÀ TÍNH NĂNG ===\n');

    try {
        // Truyền ID và Mảng Tính Năng vào hàm generate
        const dataRandom = promptBuilder.generate(ID_CONCEPT_CAN_CHAY, FEATURES);
        console.log(`🎯 Đang chạy Concept: [${dataRandom.conceptName}]`);
        
        // -----------------------------------------------------------------
        // 📸 XỬ LÝ GENERATE PROMPT CHO ẢNH (IMAGE)
        // -----------------------------------------------------------------
        const imgTemplateText = promptBuilder.loadTemplate(dataRandom.imageTemplateFile);
        const finalImagePrompt = promptBuilder.buildPromptText(imgTemplateText, dataRandom, 'image');
        promptBuilder.overwritePromptFile(FILE_OUTPUT_IMAGE, finalImagePrompt);

        // -----------------------------------------------------------------
        // 🎬 XỬ LÝ GENERATE PROMPT CHO TIMELINE VIDEO (10 GIÂY)
        // -----------------------------------------------------------------
        const videoTemplateText = promptBuilder.loadTemplate(dataRandom.videoTemplateFile);
        const finalVideoPrompt = promptBuilder.buildPromptText(videoTemplateText, dataRandom, 'video');
        promptBuilder.overwritePromptFile(FILE_OUTPUT_VIDEO, finalVideoPrompt);
        
        // LOG KẾT QUẢ SẠCH SẼ LÊN TERMINAL
        console.log('\n--- 📸 KẾT QUẢ TRỘN ẢNH (IMAGE) ---');
        console.log(`• Background:  ${dataRandom.selectedBgName}`);
        if (dataRandom.selectedUpperBody) console.log(`• Thân trên:   ${dataRandom.selectedUpperBody}`);
        if (dataRandom.selectedLeg)       console.log(`• Dáng chân:   ${dataRandom.selectedLeg}`);
        if (dataRandom.selectedHand)      console.log(`• Dáng tay:    ${dataRandom.selectedHand}`);
        
        console.log('\n--- 🎬 KẾT QUẢ TIMELINE VIDEO (LOẠI TRỪ & ĐẶT GẠCH) ---');
        console.log(`• [0.0 - 2.5s] Phân cảnh 1: ${dataRandom.segment_1_name}`);
        console.log(`• [2.5 - 5.0s] Phân cảnh 2: ${dataRandom.segment_2_name}`);
        console.log(`• [5.0 - 7.5s] Phân cảnh 3: ${dataRandom.segment_3_name}`);
        console.log(`• [7.5 - 10.s] Phân cảnh 4: ${dataRandom.segment_4_name}`);
        console.log('-------------------------------------------\n');

        console.log(`💾 Đã ghi đè toàn bộ file kịch bản thành công!`);

    } catch (error) {
        console.error('\n❌ Lỗi:', error.message);
    }
})();