# Gemini Audio API

## English

### Overview
This API service uses Google's Gemini AI to solve audio captchas. It accepts audio file URLs and returns the transcribed text.

### Prerequisites
- Node.js installed
- Google Gemini API key(s)

### Installation
1. Clone the repository
```
git clone https://github.com/x1-2023/FuncaptchaAudioSolver.git
```
```
cd FuncaptchaAudioSolver
```
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file with your Gemini API key(s):
```
GEMINI_API_KEY_1=your_api_key_here
GEMINI_API_KEY_2=your_second_api_key_here  # Optional
```

### Running the Server
```bash
node server.js
```

### API Usage
Send a POST request to `/audio` endpoint with the following JSON body:
```json
{
    "url": "https://example.com/audio.mp3",
    "title": "Audio Captcha Challenge"
}
```

### Response Format
Success response:
```json
{
    "status": true,
    "result": "transcribed text"
}
```

Error response:
```json
{
    "status": false,
    "error": "error message"
}
```

### Features
- Multiple API key support
- Automatic file cleanup
- Error handling
- Windows notifications
- Console statistics

## Tiếng Việt

### Tổng quan
API này sử dụng Gemini của Google để giải captcha âm thanh. Nó nhận URL file âm thanh và trả về văn bản được phiên âm.

### Yêu cầu
- Đã cài đặt Node.js
- API key của Google Gemini

### Cài đặt
1. Clone repository
```
git clone https://github.com/x1-2023/FuncaptchaAudioSolver.git
```
```
cd FuncaptchaAudioSolver
```
2. Cài đặt các dependencies:
```bash
npm install
```
3. Tạo file `.env` với API key của Gemini:
```
GEMINI_API_KEY_1=your_api_key_here
GEMINI_API_KEY_2=your_second_api_key_here  # Tùy chọn
```

### Chạy Server
```bash
node server.js
```

### Cách sử dụng API
Gửi request POST đến endpoint `/audio` với body JSON như sau:
```json
{
    "url": "https://example.com/audio.mp3",
    "title": "Audio Captcha Challenge"
}
```

### Định dạng phản hồi
Phản hồi thành công:
```json
{
    "status": true,
    "result": "văn bản được phiên âm"
}
```

Phản hồi lỗi:
```json
{
    "status": false,
    "error": "thông báo lỗi"
}
```

### Tính năng
- Hỗ trợ nhiều API key
- Tự động dọn dẹp file
- Xử lý lỗi
- Thông báo Windows
- Thống kê trên console 