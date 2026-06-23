const fs = require('fs');
const path = require('path');

function getPoolData() {
    const jsonPath = path.join(__dirname, 'prompt_data.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(rawData);
}

function loadTemplate(fileName) {
    const filePath = path.join(__dirname, fileName);
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`❌ Không thể đọc file template tại: ${filePath}`);
        throw error;
    }
}

function getWeightedRandom(items) {
    if (!items || items.length === 0) return '';
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const randomNum = Math.random() * totalWeight;
    let weightSum = 0;
    for (let i = 0; i < items.length; i++) {
        weightSum += items[i].weight;
        if (randomNum <= weightSum) {
            return items[i].text;
        }
    }
    return items[0].text;
}

function getRandomFromArray(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

// =========================================================================
// THUẬT TOÁN 3 BƯỚC: LỌC RÁC -> ĐẶT GẠCH -> LẤP ĐẦY (HỖ TRỢ ĐIỀU KHIỂN SÂU)
// =========================================================================

// Hàm chuẩn hóa mảng tính năng (Hỗ trợ cả String cũ và Object mới)
function normalizeFeatures(rawFeatures) {
    if (!rawFeatures || rawFeatures.length === 0) return [];
    return rawFeatures.map(f => {
        if (typeof f === 'string') {
            return { name: f, mandatory: true, allowedSlots: null };
        }
        return {
            name: f.name,
            mandatory: f.mandatory !== false, // Mặc định là true nếu không truyền
            allowedSlots: f.allowedSlots || null
        };
    });
}

function selectVideoSegments(segmentsPool, rawFeatures = []) {
    if (!segmentsPool || segmentsPool.length === 0) return {};

    const features = normalizeFeatures(rawFeatures);
    
    const finalSelection = {};
    const filledSlots = new Set();

    const mandatorySegments = [];
    let normalSegments = [];

    // Clone data để ghi đè allowedSlots không làm hỏng cấu trúc gốc trong JSON
    const pool = segmentsPool.map(seg => ({ ...seg }));

    // BƯỚC 1: Lọc phân cảnh (Xử lý Mandatory và Custom Slots)
    pool.forEach(seg => {
        if (seg.requiredFeature) {
            const featConfig = features.find(f => f.name === seg.requiredFeature);
            if (featConfig) {
                // Nếu code có truyền allowedSlots -> Ghi đè luật của JSON
                if (featConfig.allowedSlots && featConfig.allowedSlots.length > 0) {
                    seg.allowed = featConfig.allowedSlots;
                }

                // Nếu mandatory = true -> Cho vào danh sách ép buộc (Đặt gạch)
                // Nếu mandatory = false -> Cho vào danh sách bốc ngẫu nhiên (Lấp đầy)
                if (featConfig.mandatory) {
                    mandatorySegments.push(seg);
                } else {
                    normalSegments.push(seg);
                }
            }
        } else {
            normalSegments.push(seg); // Cảnh không yêu cầu tính năng thì vào list thường
        }
    });

    // BƯỚC 2: Đặt gạch cảnh bắt buộc (Pre-allocate)
    for (const mScene of mandatorySegments) {
        const validSlots = [1, 2, 3, 4].filter(slot => 
            !filledSlots.has(slot) && 
            (mScene.allowed.includes(slot) || mScene.allowed.includes("all"))
        );

        if (validSlots.length > 0) {
            const chosenSlot = getRandomFromArray(validSlots);
            finalSelection[`segment_${chosenSlot}_name`] = mScene.name;
            finalSelection[`segment_${chosenSlot}_text`] = mScene.text;
            filledSlots.add(chosenSlot);
        } else {
            console.warn(`⚠️ Cảnh báo: Cảnh bắt buộc [${mScene.name}] không còn slot trống để chèn.`);
        }
    }

    // BƯỚC 3: Lấp đầy các slot còn trống bằng cảnh thông thường
    for (let slot = 1; slot <= 4; slot++) {
        if (filledSlots.has(slot)) continue;

        const validCandidates = normalSegments.filter(scene => 
            scene.allowed.includes(slot) || scene.allowed.includes("all")
        );

        if (validCandidates.length > 0) {
            const chosenScene = getRandomFromArray(validCandidates);
            
            finalSelection[`segment_${slot}_name`] = chosenScene.name;
            finalSelection[`segment_${slot}_text`] = chosenScene.text;

            normalSegments = normalSegments.filter(scene => scene.id !== chosenScene.id);
            filledSlots.add(slot);
        } else {
            if (normalSegments.length > 0) {
                const fallbackScene = getRandomFromArray(normalSegments);
                finalSelection[`segment_${slot}_name`] = fallbackScene.name;
                finalSelection[`segment_${slot}_text`] = fallbackScene.text;
                normalSegments = normalSegments.filter(scene => scene.id !== fallbackScene.id);
                filledSlots.add(slot);
            }
        }
    }

    return finalSelection;
}

// HÀM GENERATE CHÍNH: Nhận ID động và Features từ file code gọi nó
function generate(conceptId, features = []) {
    if (!conceptId) {
        throw new Error(`❌ Lỗi: Hàm generate() yêu cầu truyền vào ID của Concept muốn chạy.`);
    }

    const POOL = getPoolData();
    const activeConcept = POOL.concepts[String(conceptId)];
    if (!activeConcept) {
        throw new Error(`❌ Không tìm thấy thông tin của concept ID: ${conceptId} trong file JSON.`);
    }

    // 1. Xử lý phần IMAGE (Bốc Background)
    let chosenBgId;
    const allowedBgIds = activeConcept.backgroundIds;
    if (Array.isArray(allowedBgIds) && allowedBgIds.includes("all")) {
        chosenBgId = getRandomFromArray(POOL.backgrounds.map(bg => bg.id));
    } else if (Array.isArray(allowedBgIds) && allowedBgIds.length > 0) {
        chosenBgId = getRandomFromArray(allowedBgIds);
    } else {
        chosenBgId = POOL.backgrounds ? POOL.backgrounds[0].id : null; 
    }

    const targetBgObj = POOL.backgrounds ? POOL.backgrounds.find(bg => bg.id === chosenBgId) : null;
    const selectedBgName = targetBgObj ? targetBgObj.name : 'Mặc định';
    const selectedBgText = targetBgObj ? targetBgObj.text : '';

    const poses = activeConcept.poses || {};
    const selectedUpperBody = poses.upperBody ? getWeightedRandom(poses.upperBody) : '';
    const selectedLeg = poses.leg ? getWeightedRandom(poses.leg) : '';
    const selectedHand = poses.hand ? getWeightedRandom(poses.hand) : '';

    // 2. Xử lý phần VIDEO (Bốc phân cảnh loại trừ kèm features)
    const videoData = selectVideoSegments(activeConcept.videoSegments, features);

    return {
        conceptName: activeConcept.name,
        imageTemplateFile: activeConcept.imageTemplateFile,
        videoTemplateFile: activeConcept.videoTemplateFile,
        selectedBgName,
        selectedBgText,
        selectedUpperBody,
        selectedLeg,
        selectedHand,
        ...videoData 
    };
}

function buildPromptText(templateText, promptData, type = 'image') {
    let text = templateText;

    if (type === 'image') {
        text = text.replace('{{SELECTED_BACKGROUND}}', promptData.selectedBgText || '');
        if (promptData.selectedUpperBody) text = text.replace('{{SELECTED_UPPER_BODY}}', promptData.selectedUpperBody);
        if (promptData.selectedLeg) text = text.replace('{{SELECTED_LEG}}', promptData.selectedLeg);
        if (promptData.selectedHand) text = text.replace('{{SELECTED_HAND}}', promptData.selectedHand);
    } 
    else if (type === 'video') {
        text = text.replace(/\{\{SEGMENT_1\}\}/g, promptData.segment_1_text || '');
        text = text.replace(/\{\{SEGMENT_2\}\}/g, promptData.segment_2_text || '');
        text = text.replace(/\{\{SEGMENT_3\}\}/g, promptData.segment_3_text || '');
        text = text.replace(/\{\{SEGMENT_4\}\}/g, promptData.segment_4_text || '');
    }

    return text;
}

function overwritePromptFile(filePath, finalContent) {
    try {
        fs.writeFileSync(filePath, finalContent, 'utf8');
    } catch (error) {
        console.error(`❌ Lỗi khi ghi đè file ${filePath}:`, error.message);
    }
}

module.exports = {
    loadTemplate,
    generate,
    buildPromptText,
    overwritePromptFile
};