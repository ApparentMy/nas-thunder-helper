// 初始化模块
document.addEventListener("DOMContentLoaded", initAllfunction);

// 主初始化函数
async function initAllfunction() {
  try {
    const formElement = {
      xunleiUrl: document.querySelector(".input[name='xunlei-url']"),
      deepseekapikey: document.querySelector(".input[name='deepseekapikey']"),
      qwenapikey: document.querySelector(".input[name='qwenapikey']"),
      saveBtn: document.querySelector(".save"),
      timeout: document.querySelector(".input[name='timeout']"),
      aiSwitchBtn: document.querySelector(".ai-switch"),
      downloadBtn: document.querySelector(".download"),
      exUrl:document.querySelector(".input[name='exUrl']")
    };

    await initAutoFillContent(
      formElement.xunleiUrl,
      formElement.deepseekapikey,
      formElement.qwenapikey,
      formElement.timeout,
      formElement.aiSwitchBtn,
    );
    const ischangeState = initisChangeInputValue(
      formElement.xunleiUrl,
      formElement.deepseekapikey,
      formElement.qwenapikey,
      formElement.timeout,
    );
    initSaveConfig(
      formElement.saveBtn,
      formElement.xunleiUrl,
      formElement.deepseekapikey,
      formElement.qwenapikey,
      formElement.timeout,
      ischangeState,
    );
    download(formElement.downloadBtn,formElement.exUrl);

    if (formElement.aiSwitchBtn) {
      initAiSwitch(formElement.aiSwitchBtn);
    }
  } catch (error) {
    console.error("初始化失败！",error);
    alert("页面初始化失败，请重新打开插件！",error);
  }
}

// 保存配置
function initSaveConfig(
  saveBtn,
  xunleiUrlElement,
  deepseekapikeyElemnet,
  qwenapikeyElemnet,
  timeoutElement,
  ischangeState,
) {
  saveBtn.addEventListener("click", async function (e) {
    const changedFields = [];
    const errors = [];
    
    // 检查URL变更和验证
    if (ischangeState[0]) {
      const urlError = vaildateUrlFormat(xunleiUrlElement.value);
      if (urlError) {
        errors.push(`URL: ${urlError}`);
      } else {
        changedFields.push({
          key: "xunleiUrl",
          value: xunleiUrlElement.value,
          name: "URL"
        });
      }
    }
    
    // 检查DeepSeek API Key变更和验证
    if (ischangeState[1]) {
      const deepseekError = validateApiKeyFormat(deepseekapikeyElemnet.value);
      if (deepseekError) {
        errors.push(`DeepSeek API Key: ${deepseekError}`);
      } else {
        changedFields.push({
          key: "deepseekapikey",
          value: deepseekapikeyElemnet.value,
          name: "DeepSeek API Key"
        });
      }
    }
    
    // 检查Qwen API Key变更和验证
    if (ischangeState[2]) {
      const qwenError = validateApiKeyFormat(qwenapikeyElemnet.value);
      if (qwenError) {
        errors.push(`Qwen API Key: ${qwenError}`);
      } else {
        changedFields.push({
          key: "qwenapikey",
          value: qwenapikeyElemnet.value,
          name: "Qwen API Key"
        });
      }
    }
    
    // 检查超时时间变更和验证
    if (ischangeState[3]) {
      const timeoutValue = timeoutElement.value;
      if (timeoutValue < 300 || timeoutValue > 10000) {
        errors.push("超时时间必须在300-10000毫秒之间");
      } else {
        changedFields.push({
          key: "timeout",
          value: timeoutValue,
          name: "超时时间"
        });
      }
    }
    
    // 如果没有变更的字段
    if (changedFields.length === 0 && errors.length === 0) {
      alert("未检测到更改！");
      return;
    }
    
    // 如果有验证错误
    if (errors.length > 0) {
      alert(`格式错误：\n${errors.join("\n")}`);
      return;
    }
    
    // 保存所有变更的字段
    try {
      const promises = changedFields.map(field => 
        saveConfig(field.key, field.value, field.name)
      );
      
      await Promise.all(promises);
      
      // 更新监控的初始值
      if (changedFields.find(f => f.key === "xunleiUrl")) {
        ischangeState[0] = 0;
      }
      if (changedFields.find(f => f.key === "deepseekapikey")) {
        ischangeState[1] = 0;
      }
      if (changedFields.find(f => f.key === "qwenapikey")) {
        ischangeState[2] = 0;
      }
      if (changedFields.find(f => f.key === "timeout")) {
        ischangeState[3] = 0;
      }
      
      const savedFields = changedFields.map(f => f.name).join("、");
      alert(`保存成功：${savedFields}`);
      
    } catch (error) {
      alert(error);
    }
  });
}

// 获取配置
async function getConfig() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(
      ["xunleiUrl", "deepseekapikey", "qwenapikey", "timeout", "aiProvider"],
      (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      },
    );
  });
}

// 存储配置
async function saveConfig(keyName, value, noteText) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [keyName]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(`保存${noteText}失败：${chrome.runtime.lastError}`);
      } else {
        resolve(`保存${noteText}成功!`);
      }
    });
  });
}

// 填充表单内容
async function initAutoFillContent(
  xunleiUrlElement,
  deepseekapikey,
  qwenapikey,
  timeoutElement,
  aiSwitchBtn,
) {
  try {
    const config = await getConfig();
    const [massDsApiKey, massqwenApikey] = await Promise.all([
      getMassApiKey(config.deepseekapikey),
      getMassApiKey(config.qwenapikey),
    ]);
    if (config) {
      xunleiUrlElement.value = config.xunleiUrl;
      deepseekapikey.value = massDsApiKey;
      qwenapikey.value = massqwenApikey;
      timeoutElement.value = config.timeout;

      if (aiSwitchBtn) {
        const currentProvider = config.aiProvider || "deepseek";
        updateAiSwitchButton(aiSwitchBtn, currentProvider);
      }

      console.log("从同步存储获取数据成功！");
    }
  } catch (error) {
    console.error("从同步存储获取数据失败！");
    console.log(error);
  }
}

// AI切换功能
function initAiSwitch(aiSwitchBtn) {
  if (!aiSwitchBtn) return;

  aiSwitchBtn.addEventListener("click", async function () {
    try {
      const config = await getConfig();
      const currentProvider = config.aiProvider || "deepseek";
      const newProvider = currentProvider === "deepseek" ? "qwen" : "deepseek";

      await saveConfig("aiProvider", newProvider, "AI提供商");
      updateAiSwitchButton(aiSwitchBtn, newProvider);

      console.log(`AI已切换到: ${newProvider}`);
    } catch (error) {
      console.error("切换AI失败:", error);
    }
  });
}

// 更新AI切换按钮
function updateAiSwitchButton(button, provider) {
  if (!button) return;

  const providerNames = {
    deepseek: "DeepSeek",
    qwen: "Qwen",
  };

  const targetProvider = provider === "deepseek" ? "qwen" : "deepseek";
  button.textContent = `切换到${providerNames[targetProvider]}`;
  button.title = `当前使用: ${providerNames[provider]}`;
  button.style.backgroundColor =
    provider === "deepseek" ? "#4CAF50" : "#2196F3";
}

// 获取当前AI提供商
async function getCurrentAiProvider() {
  try {
    const config = await getConfig();
    return config.aiProvider || "deepseek";
  } catch (error) {
    console.error("获取AI提供商失败:", error);
    return "deepseek";
  }
}

// API密钥脱敏显示
async function getMassApiKey(apiKey) {
  try {
    if (apiKey) {
      return apiKey.slice(0, 6) + "*".repeat(apiKey.length - 6);
    }
  } catch (error) {
    console.log("加密失败，拒绝返回");
    console.log(error);
    return "";
  }
}

// API密钥格式验证
function validateApiKeyFormat(userInputApiKey) {
  const error = [];

  if (userInputApiKey.length < 8) {
    error.push("apiKey 至少是8位！");
  }
  if (!userInputApiKey.startsWith("sk-")) {
    error.push("apikey 开头必须为SK-!");
  }
  if (/[^a-zA-Z0-9_-]/.test(userInputApiKey)) {
    error.push("apikey 包含不允许的特殊字符！");
  }
  return error.length === 0 ? null : error;
}

// URL格式验证
function vaildateUrlFormat(userInputUrl) {
  const error = [];
  if (
    !userInputUrl.startsWith("http://") &&
    !userInputUrl.startsWith("https://")
  ) {
    error.push('url 必须以"http://" 或 "https://"开头！');
  }
  return error.length === 0 ? null : error;
}

// 输入状态监控
function initisChangeInputValue(
  xunleiUrlElement,
  deepseekapikey,
  qwenapikey,
  timeoutElement,
) {
  let laterUrlValue = xunleiUrlElement.value;
  let laterdeepseekapikey = deepseekapikey.value;
  let laterqwenapikey = qwenapikey.value;
  let latertimeoutValue = timeoutElement.value;
  const ischange = [0, 0, 0, 0];

  xunleiUrlElement.addEventListener("blur", () => {
    xunleiUrlElement.value == laterUrlValue
      ? (ischange[0] = 0)
      : (ischange[0] = 1);
  });
  deepseekapikey.addEventListener("blur", () => {
    deepseekapikey.value == laterdeepseekapikey
      ? (ischange[1] = 0)
      : (ischange[1] = 1);
  });
  qwenapikey.addEventListener("blur", () => {
    qwenapikey.value == laterqwenapikey ? (ischange[2] = 0) : (ischange[2] = 1);
  });
  timeoutElement.addEventListener("blur", () => {
    timeoutElement.value == latertimeoutValue
      ? (ischange[3] = 0)
      : (ischange[3] = 1);
  });
  return ischange;
}

function download(btnElement,exUrlElement){
  btnElement.addEventListener("click",()=>{
    const links = exUrlElement.value
    console.log(links);
    
    chrome.runtime.sendMessage({
      type:"XUNLEI_DOWNLOAD_LINK",
      links:links
    })
  })
}


// 打开设置页面
document.querySelector(".setting").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
