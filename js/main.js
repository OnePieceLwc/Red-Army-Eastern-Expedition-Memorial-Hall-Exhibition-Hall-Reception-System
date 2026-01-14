// 主逻辑文件
// 全局变量
let digitalHuman = null;
let glmAI = null;
let chatHistory = [];
let isProcessing = false;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initConfigPage();
});

// ==================== 密钥配置页面逻辑 ====================

/**
 * 初始化配置页面
 */
function initConfigPage() {
    updateKeyTypeDisplay();
    
    // 检查是否已有API KEY
    const apiKey = storage.getApiKey();
    if (apiKey) {
        document.getElementById('api-key').value = apiKey;
    }
}

/**
 * 更新密钥类型显示
 */
function updateKeyTypeDisplay() {
    const keyTypeElement = document.getElementById('key-type');
    const displayText = storage.getKeyTypeDisplayText();
    keyTypeElement.textContent = displayText;
    
    // 根据类型设置颜色
    if (displayText === '未设置') {
        keyTypeElement.style.color = '#999';
    } else if (displayText === '内置测试密钥') {
        keyTypeElement.style.color = '#FF9800';
    } else {
        keyTypeElement.style.color = '#4CAF50';
    }
}

/**
 * 切换密码显示/隐藏
 */
function togglePassword() {
    const input = document.getElementById('api-key');
    const button = document.querySelector('.toggle-password');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

/**
 * 使用测试密钥
 */
function useTestKey() {
    const testKey = CONFIG.glm.testApiKey;
    storage.saveApiKey(testKey, 'test');
    document.getElementById('api-key').value = testKey;
    updateKeyTypeDisplay();
    alert('✅ 已使用内置测试密钥');
}

/**
 * 保存自定义密钥
 */
function saveCustomKey() {
    const apiKey = document.getElementById('api-key').value.trim();
    
    if (!apiKey) {
        alert('❌ 请输入API密钥');
        return;
    }
    
    if (!apiKey.includes('.')) {
        alert('❌ API密钥格式不正确，应包含点号');
        return;
    }
    
    storage.saveApiKey(apiKey, 'custom');
    updateKeyTypeDisplay();
    alert('✅ 自定义密钥已保存');
}

/**
 * 清除密钥
 */
function clearKey() {
    if (confirm('确定要清除API密钥吗？')) {
        storage.clearApiKey();
        document.getElementById('api-key').value = '';
        updateKeyTypeDisplay();
        alert('✅ 密钥已清除');
    }
}

/**
 * 进入展厅
 */
function enterHall() {
    const apiKey = storage.getApiKey();
    
    if (!apiKey) {
        alert('⚠️ 请先设置GLM API密钥');
        return;
    }
    
    // 切换到展厅页面
    document.getElementById('config-page').classList.remove('active');
    document.getElementById('hall-page').classList.add('active');
    
    // 初始化展厅
    initHall();
}

// ==================== 展厅主界面逻辑 ====================

/**
 * 初始化展厅
 */
function initHall() {
    // 检查SDK是否加载
    if (typeof XmovAvatar === 'undefined') {
        alert('❌ 数字人SDK未加载，请刷新页面重试');
        console.error('XmovAvatar未定义，SDK可能未正确加载');
        return;
    }
    
    // 初始化GLM AI
    const apiKey = storage.getApiKey();
    glmAI = new GLMAIManager(apiKey);
    
    // 初始化数字人
    digitalHuman = new DigitalHumanManager({
        appId: CONFIG.digitalHuman.appId,
        appSecret: CONFIG.digitalHuman.appSecret,
        gatewayServer: CONFIG.digitalHuman.gatewayServer,
        containerId: CONFIG.digitalHuman.containerId,
        onConnect: () => onDigitalHumanConnect(),
        onDisconnect: () => onDigitalHumanDisconnect(),
        onStateChange: (state) => onDigitalHumanStateChange(state),
        onMessage: (message) => console.log('数字人消息:', message),
        onError: (error) => onDigitalHumanError(error)
    });
    
    // 初始化SDK
    const initSuccess = digitalHuman.init();
    if (!initSuccess) {
        alert('❌ 数字人SDK初始化失败');
        return;
    }
    
    console.log('数字人SDK初始化成功，等待连接...');
    
    // 加载预置问题
    loadPresetQuestions();
    
    // 加载对话历史
    loadChatHistory();
    
    // 绑定回车发送事件
    document.getElementById('user-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

/**
 * 加载预置问题
 */
function loadPresetQuestions() {
    const grid = document.getElementById('questions-grid');
    grid.innerHTML = '';
    
    CONFIG.presetQuestions.forEach(q => {
        const button = document.createElement('button');
        button.className = 'question-btn';
        button.innerHTML = `<span class="question-icon">${q.icon}</span>${q.question}`;
        button.onclick = () => askPresetQuestion(q.question);
        grid.appendChild(button);
    });
}

/**
 * 加载对话历史
 */
function loadChatHistory() {
    chatHistory = storage.getChatHistory();
}

/**
 * 询问预置问题
 * @param {string} question - 问题
 */
function askPresetQuestion(question) {
    document.getElementById('user-input').value = question;
    sendMessage();
}

// ==================== 数字人控制逻辑 ====================

/**
 * 切换连接状态
 */
function toggleConnection() {
    const btn = document.getElementById('connect-btn');
    
    if (digitalHuman.getIsConnected()) {
        // 断开连接
        digitalHuman.disconnect();
        btn.textContent = '🔌 连接数字人';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');
    } else {
        // 连接
        btn.textContent = '⏳ 连接中...';
        btn.disabled = true;
        
        showLoading('正在连接数字人...');
        
        digitalHuman.connect((progress) => {
            console.log('连接进度:', progress);
            if (progress === 100) {
                hideLoading();
                console.log('资源加载完成，等待数字人初始化...');
            }
        });
        
        // 注意：连接成功后会通过onDigitalHumanConnect回调自动处理UI更新
        // 所以这里不需要手动处理
    }
}

/**
 * 数字人连接成功回调
 */
function onDigitalHumanConnect() {
    console.log('数字人已连接');
    
    hideLoading();
    updateConnectionStatus('online');
    
    // 更新按钮状态
    const btn = document.getElementById('connect-btn');
    btn.textContent = '⏹️ 断开连接';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');
    btn.disabled = false;
    
    // 隐藏占位符
    const placeholder = document.querySelector('.avatar-placeholder');
    if (placeholder) {
        placeholder.classList.add('hidden');
    }
    
    // 连接成功后，让数字人问候
    setTimeout(() => {
        digitalHuman.listen();
        setTimeout(() => {
            processAIResponse('欢迎来到红军东征纪念馆！我是您的智能讲解员，有什么可以帮助您的吗？');
        }, 1000);
    }, 500);
}

/**
 * 数字人断开连接回调
 */
function onDigitalHumanDisconnect() {
    console.log('数字人已断开');
    updateConnectionStatus('offline');
    
    // 显示占位符
    const placeholder = document.querySelector('.avatar-placeholder');
    if (placeholder) {
        placeholder.classList.remove('hidden');
    }
}

/**
 * 数字人状态变化回调
 * @param {string} state - 状态
 */
function onDigitalHumanStateChange(state) {
    console.log('数字人状态:', state);
    
    if (state === 'speaking') {
        updateConnectionStatus('speaking');
    } else {
        updateConnectionStatus('online');
    }
}

/**
 * 数字人错误回调
 * @param {Error} error - 错误对象
 */
function onDigitalHumanError(error) {
    console.error('数字人错误:', error);
    alert('❌ 数字人发生错误: ' + error.message);
}

/**
 * 更新连接状态显示
 * @param {string} status - 状态（'online', 'offline', 'speaking'）
 */
function updateConnectionStatus(status) {
    const indicator = document.querySelector('.status-indicator');
    const text = document.querySelector('.status-text');
    
    indicator.classList.remove('online', 'offline', 'speaking');
    indicator.classList.add(status);
    
    const statusTexts = {
        'online': '已连接',
        'offline': '未连接',
        'speaking': '讲解中'
    };
    text.textContent = statusTexts[status];
}

/**
 * 调节音量
 */
function adjustVolume() {
    const slider = document.getElementById('volume-slider');
    const isVisible = slider.style.display !== 'none';
    
    if (isVisible) {
        slider.style.display = 'none';
    } else {
        slider.style.display = 'flex';
    }
}

/**
 * 设置音量
 * @param {string} value - 音量值
 */
function setVolume(value) {
    const volume = parseFloat(value);
    digitalHuman.setVolume(volume);
    document.getElementById('volume-value').textContent = Math.round(volume * 100) + '%';
}

/**
 * 切换调试信息
 */
let debugVisible = false;
function toggleDebug() {
    debugVisible = !debugVisible;
    
    if (debugVisible) {
        digitalHuman.showDebugInfo();
    } else {
        digitalHuman.hideDebugInfo();
    }
}

// ==================== 对话逻辑 ====================

/**
 * 发送消息
 */
async function sendMessage() {
    if (isProcessing) {
        alert('⏳ 正在处理中，请稍候...');
        return;
    }
    
    const input = document.getElementById('user-input');
    const question = input.value.trim();
    
    if (!question) {
        alert('❌ 请输入问题');
        return;
    }
    
    // 检查API KEY
    const apiKey = storage.getApiKey();
    if (!apiKey) {
        alert('❌ API密钥未设置，请重新进入');
        return;
    }
    
    // 添加用户消息
    addMessageToChat('user', question);
    chatHistory.push({ role: 'user', content: question });
    
    // 清空输入框
    input.value = '';
    
    // 开始处理
    isProcessing = true;
    updateSendButtonState();
    
    // 数字人进入思考状态
    if (digitalHuman.getIsConnected()) {
        digitalHuman.think();
    }
    
    try {
        showLoading('AI思考中...');
        
        let response = '';
        
        if (digitalHuman.getIsConnected()) {
            // 先创建一个空的assistant消息
            addMessageToChat('assistant', '');
            
            // 流式响应
            response = await glmAI.askQuestion(
                question,
                CONFIG.systemPrompt,
                chatHistory.slice(1, -1), // 排除第一条系统消息
                (chunk, full) => {
                    // 显示流式响应
                    updateAssistantMessage(full);
                }
            );
            
            // 隐藏loading
            hideLoading();
            
            // 让数字人说话
            if (digitalHuman.getIsConnected()) {
                digitalHuman.listen(); // 先进入倾听状态
                await new Promise(resolve => setTimeout(resolve, 300)); // 等待状态切换
                digitalHuman.speak(response, true, true); // 开始说话
            }
        } else {
            // 非流式响应
            response = await glmAI.askQuestion(question, CONFIG.systemPrompt, chatHistory.slice(1, -1));
            addMessageToChat('assistant', response);
        }
        
        // 添加到历史
        chatHistory.push({ role: 'assistant', content: response });
        
        // 限制历史长度
        if (chatHistory.length > CONFIG.maxHistoryRounds * 2 + 1) {
            chatHistory = [chatHistory[0], ...chatHistory.slice(-CONFIG.maxHistoryRounds * 2)];
        }
        
        // 保存历史
        storage.saveChatHistory(chatHistory);
        
    } catch (error) {
        console.error('AI调用失败:', error);
        addMessageToChat('system', '❌ 抱歉，我遇到了一些问题：' + error.message);
    } finally {
        hideLoading();
        isProcessing = false;
        updateSendButtonState();
    }
}

/**
 * 处理AI响应并让数字人说话
 * @param {string} response - AI响应内容
 */
function processAIResponse(response) {
    // 添加到对话历史
    addMessageToChat('assistant', response);
    
    // 让数字人说话
    if (digitalHuman.getIsConnected()) {
        digitalHuman.speak(response);
    }
    
    // 更新历史
    chatHistory.push({ role: 'assistant', content: response });
    storage.saveChatHistory(chatHistory);
}

/**
 * 添加消息到对话区域
 * @param {string} type - 消息类型（'user', 'assistant', 'system'）
 * @param {string} content - 消息内容
 */
function addMessageToChat(type, content) {
    const container = document.getElementById('chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    let avatar = '';
    if (type === 'user') {
        avatar = '👤';
    } else if (type === 'assistant') {
        avatar = '🤖';
    } else {
        avatar = 'ℹ️';
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${content}</p>
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

/**
 * 更新助手消息（用于流式响应）
 * @param {string} content - 消息内容
 */
function updateAssistantMessage(content) {
    let lastMessage = document.querySelector('.message.assistant:last-child');
    
    if (!lastMessage) {
        addMessageToChat('assistant', content);
    } else {
        const p = lastMessage.querySelector('.message-content p');
        if (p) {
            p.textContent = content;
        }
    }
    
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

/**
 * 更新发送按钮状态
 */
function updateSendButtonState() {
    const btn = document.getElementById('send-btn');
    btn.disabled = isProcessing;
    btn.textContent = isProcessing ? '⏳ 发送中...' : '📤 发送';
}

// ==================== 工具函数 ====================

/**
 * 显示加载遮罩
 * @param {string} text - 加载文本
 */
function showLoading(text = '加载中...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = text;
    overlay.style.display = 'flex';
}

/**
 * 隐藏加载遮罩
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
}

// 页面卸载时断开数字人连接
window.addEventListener('beforeunload', () => {
    if (digitalHuman && digitalHuman.getIsConnected()) {
        digitalHuman.disconnect();
    }
});
