require('dotenv').config(); // Load biến môi trường từ .env
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises; // Sử dụng fs.promises cho async/await
const path = require('path');
const crypto = require('crypto');
const os = require('os'); // << Thêm module os để lấy IP LAN
const chalk = require('chalk');
const notifier = require('node-notifier');
const {
  GoogleGenAI
} = require("@google/genai");

const app = express();
const port = process.env.PORT || 3000; // Sử dụng cổng từ env hoặc mặc định 3000

// Middleware để parse JSON request body
app.use(express.json());

// Thống kê
let stats = {
    success: 0,
    failed: 0
};

// Hàm cập nhật tiêu đề console
function updateConsoleTitle() {
    process.title = `Gemini Audio API | Success: ${stats.success} | Failed: ${stats.failed}`;
}

// Hàm hiển thị thông báo Windows
function showNotification(title, message) {
    notifier.notify({
        title: title,
        message: message,
        icon: path.join(__dirname, 'icon.png'),
        sound: true
    });
}

// --- Cấu hình Gemini ---
// Lấy tất cả API keys từ .env
const getGeminiApiKeys = () => {
    const keys = [];
    let i = 1;
    while (process.env[`GEMINI_API_KEY_${i}`]) {
        keys.push(process.env[`GEMINI_API_KEY_${i}`]);
        i++;
    }
    return keys;
};

const GEMINI_API_KEYS = getGeminiApiKeys();
if (GEMINI_API_KEYS.length === 0) {
    console.error("❌ Lỗi: Vui lòng đặt ít nhất một biến môi trường GEMINI_API_KEY_1 trong file .env");
    process.exit(1);
}

// Hàm lấy random API key
const getRandomApiKey = () => {
    const randomIndex = Math.floor(Math.random() * GEMINI_API_KEYS.length);
    return GEMINI_API_KEYS[randomIndex];
};

// Khởi tạo Gemini client với API key mới mỗi lần gọi
const getGeminiClient = () => {
    const apiKey = getRandomApiKey();
    console.log(`Sử dụng API Key: ${apiKey.substring(0, 10)}...`);
    return new GoogleGenAI({ apiKey });
};

// --- Thư mục tạm ---
const TEMP_DIR = path.join(__dirname, 'temp_audio');

// --- Hàm tiện ích ---

// Hàm tải file từ URL và lưu vào thư mục tạm
async function downloadFile(url, filePath) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 10000, // Thêm timeout 10 giây
            validateStatus: function (status) {
                return status >= 200 && status < 300; // Chỉ chấp nhận status 2xx
            }
        });
        const mimeType = response.headers['content-type'] || 'audio/mpeg';
        await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve({ filePath, mimeType }));
            writer.on('error', (err) => {
                fs.unlink(filePath, () => {});
                console.error("Lỗi khi ghi file:", err);
                reject(new Error(`Không thể ghi file tải về: ${err.message}`));
            });
             response.data.on('error', (err) => {
                writer.close();
                fs.unlink(filePath, () => {});
                console.error("Lỗi khi tải stream:", err);
                reject(new Error(`Lỗi khi tải file từ URL: ${err.message}`));
            });
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Lỗi Axios khi tải ${url}:`, error.response?.status, error.message);
            throw new Error(`Không thể tải file từ URL (status: ${error.response?.status || 'N/A'})`);
        } else {
            console.error(`Lỗi không xác định khi tải ${url}:`, error);
            throw new Error(`Lỗi không xác định khi tải file: ${error.message}`);
        }
    }
}

// Hàm đọc file và chuyển sang base64
async function readFileAsBase64(filePath) {
    try {
        console.log(`Đang đọc file: ${filePath}`);
        const data = await fsPromises.readFile(filePath, { encoding: 'base64' });
        return data;
    } catch (error) {
        console.error("\nLỗi khi đọc file:", error);
        throw new Error(`Không thể đọc file: ${error.message}`);
    }
}

function getLanIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return null;
}

async function getPublicIp() {
    try {
        const response = await axios.get('https://icanhazip.com');
        return response.data.trim();
    } catch (error) {
        console.warn("Không thể lấy địa chỉ IP Public:", error.message);
        return null;
    }
}

// --- Định nghĩa API Endpoint ---
app.post('/audio', async (req, res) => {
    const { url, title: userProvidedTitle } = req.body;
    let tempFilePath = null;

    // --- 1. Validation ---
    if (!url || !userProvidedTitle) {
        return res.status(400).json({ status: false, error: 'Thiếu tham số `url` hoặc `title` trong request body.' });
    }
    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ status: false, error: 'URL không hợp lệ.' });
    }

    // Log với title người dùng cung cấp
    console.log(chalk.cyan('\n' + '='.repeat(50)));
    console.log(chalk.yellow('📢 Yêu cầu mới'));
    console.log(chalk.gray('URL:'), chalk.white(url));
    console.log(chalk.gray('Title:'), chalk.white(userProvidedTitle));

    try {
        // --- 2. Tạo tên file ngẫu nhiên ---
        const urlParts = new URL(url);
        const extension = path.extname(urlParts.pathname) || '.mp3';
        const randomFileName = `${crypto.randomUUID()}${extension}`;
        tempFilePath = path.join(TEMP_DIR, randomFileName);
        console.log(chalk.gray('File tạm:'), chalk.white(tempFilePath));

        // --- 3. Tải file về ---
        console.log(chalk.blue('⬇️  Đang tải file...'));
        const { mimeType } = await downloadFile(url, tempFilePath);
        console.log(chalk.green('✅ Tải file thành công'), chalk.gray(`(MIME: ${mimeType})`));

        // --- 4. Đọc file và chuyển sang base64 ---
        console.log(chalk.blue('📖 Đang đọc file...'));
        const base64Data = await readFileAsBase64(tempFilePath);

        // --- 5. Hỏi Gemini ---
        console.log(chalk.blue('🤖 Đang giải captcha...'));
        const fullPromptTitle = `Audio Challenge: ${userProvidedTitle}`;

        const contents = [
            { text: fullPromptTitle },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            }
        ];

        // Sử dụng API key mới cho mỗi request
        const genAI = getGeminiClient();
        const result = await genAI.models.generateContent({
            model: "gemini-2.0-flash",
            contents: contents
        });

        // --- 6. Xử lý kết quả từ Gemini ---
        if (!result || !result.candidates || result.candidates.length === 0) {
            throw new Error(`Gemini không trả về kết quả.`);
        }

        const geminiResponseText = result.candidates[0].content.parts
            .map(part => part.text)
            .join("");

        if (!geminiResponseText) {
            throw new Error(`Gemini trả về kết quả rỗng.`);
        }

        // Xóa các ký tự \n trong kết quả
        const cleanResponse = geminiResponseText.replace(/\n/g, '').trim();

        // Cập nhật thống kê
        stats.success++;
        updateConsoleTitle();

        // Hiển thị kết quả
        console.log(chalk.green('✨ Kết quả:'), chalk.white(cleanResponse));
        console.log(chalk.cyan('='.repeat(50)));

        // --- 7. Gửi kết quả về cho client ---
        res.status(200).json({ status: true, result: cleanResponse });

    } catch (error) {
        // Cập nhật thống kê
        stats.failed++;
        updateConsoleTitle();

        // Log lỗi
        console.error(chalk.red('\n❌ Lỗi:'), chalk.white(error.message));
        console.log(chalk.cyan('='.repeat(50)));

        // Hiển thị thông báo Windows
        showNotification('Gemini Audio API Error', error.message);

        res.status(500).json({ status: false, error: error.message });
    } finally {
        // --- 8. Xóa file tạm (luôn thực hiện) ---
        if (tempFilePath) {
            try {
                await fsPromises.unlink(tempFilePath);
            } catch (cleanupError) {
                console.log(chalk.yellow('⚠️  Không thể xóa file tạm:'), chalk.white(cleanupError.message));
            }
        }
    }
});

// --- Khởi động Server (sử dụng async IIFE) ---
(async () => {
    try {
        // Đảm bảo thư mục tạm tồn tại
        await fsPromises.mkdir(TEMP_DIR, { recursive: true });
        console.log(chalk.green('📁 Thư mục tạm:'), chalk.white(TEMP_DIR));

        const lanIp = getLanIp();
        const publicIp = await getPublicIp();

        app.listen(port, () => {
            console.log(chalk.cyan('\n' + '='.repeat(50)));
            console.log(chalk.green('🚀 Gemini Audio API đang chạy!'));
            console.log(chalk.gray('Localhost:'), chalk.white(`http://localhost:${port}/audio`));
            if (lanIp) {
                console.log(chalk.gray('Mạng LAN:'), chalk.white(`http://${lanIp}:${port}/audio`));
            }
            if (publicIp) {
                console.log(chalk.gray('Public:'), chalk.white(`http://${publicIp}:${port}/audio`));
            }
            console.log(chalk.cyan('='.repeat(50)));
            
            // Thêm ví dụ payload JSON
            console.log(chalk.yellow('\n📝 Ví dụ payload JSON:'));
            console.log(chalk.white(JSON.stringify({
                url: "https://example.com/audio.mp3",
                title: "Giải captcha âm thanh"
            }, null, 2)));
            
            console.log(chalk.cyan('='.repeat(50)));
            console.log(chalk.yellow('👂 Đang chờ yêu cầu...\n'));

            // Cập nhật tiêu đề console ban đầu
            updateConsoleTitle();
        });

    } catch (err) {
        console.error(chalk.red('❌ Lỗi nghiêm trọng khi khởi động server:'), chalk.white(err.message));
        if (err.code === 'EADDRINUSE') {
            console.error(chalk.yellow('   Gợi ý: Cổng có thể đang được sử dụng bởi ứng dụng khác.'));
        }
        process.exit(1);
    }
})();