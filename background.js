// 暂时还不支持不进入迅雷下载页面
let link;
const ifEntern = true;

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if (message.type === "XUNLEI_DOWNLOAD_LINK") {
    link = message.links;
    start();
  }
  
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "PCToNASMenu",
    title: "发送到NAS",
    contexts: ["link"],
  });
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info) => {
  //获取指向元素的链接
  if (info.linkUrl) {
    link = info.linkUrl;
  }
  //运行
  start();
});

// 获取配置文件
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



// 执行下载任务
async function start() {
  const config = await getConfig();
  const tabId = await openPage();
  console.log(tabId);

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: async (config, link) => {
      console.log("注入成功");
      console.log(config);

      //打开新建任务界面
      async function addNewTag() {
        try {
          console.log("正在点击新建任务");
          const addTag = await waitElement(".create__task", config.timeout);
          const addTagEvent = new Event("click");
          addTag.dispatchEvent(addTagEvent);
        } catch (error) {
          console.log("打开新建任务界面失败：", error);
        }
      }

      // 填充链接
      async function fullInlink() {
        try {
          console.log("正在填充链接");
          const inputElement = await waitElement(
            ".el-textarea__inner",
            config.timeout,
          );
          const InputEvent = new Event("input");
          const comfirm = new Event("click");
          inputElement.value = link;
          inputElement.dispatchEvent(InputEvent);
          const comfirmElement = await waitElement(".task-parse-btn");
          comfirmElement.dispatchEvent(comfirm);
        } catch (error) {
          console.log("填充链接失败：", error);
        }
      }

      // 获取文件名
      async function GetFileName() {
        try {
          console.log("正在获取文件名称");
          let folderName = null;
          let fileNameList = [];
          await waitElement(".file_title", config.timeout);
          const fileNameisCheckList = await waitElement(
            "div .is-checked .file_title",
            config.timeout,
            null,
            true,
          );
          for (let i = 0; i < fileNameisCheckList.length; i++) {
            fileNameList.push(fileNameisCheckList[i].innerHTML);
          }
          if (document.querySelector(".file_name .label_txt")) {
            folderName = document.querySelector(".file_name .label_txt");
            return [folderName.innerHTML, fileNameList];
          }
          return [null, fileNameList];
        } catch (error) {
          console.error("获取文件名失败：", error);
        }
      }
      // 调用AI
      async function fetchAI(aiConfig, originalFolderName, originalFileList) {
        const deepseekdata = {
          model: aiConfig.model,
          messages: [
            {
              role: "system",
              content: aiConfig.systemPrompt,
            },
            {
              role: "user",
              content: `翻译参考内容，文件夹名称：${originalFolderName},内含的文件名：${originalFileList}`,
            },
          ],
        };
        const qwendata = {
          model: aiConfig.model,
          messages: [
            {
              role: "system",
              content: aiConfig.systemPrompt,
            },
            {
              role: "user",
              content: `翻译参考内容，文件夹名称：${originalFolderName},内含的文件名：${originalFileList}`,
            },
          ],
          extra_body: {
            enable_search: true,
          },
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, config.timeout);
        try {
          const requestBody =
            aiConfig.model === "qwen3-max" ? qwendata : deepseekdata;
          const response = await fetch(aiConfig.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiConfig.apikey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP错误：${response.status}`);
          }

          const newName = await response.json();
          return newName.choices[0].message.content.trim();
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === "AbortError") {
            console.error(`请求d${aiConfig.model}超时：`, error);
          } else {
            console.error(`请求${aiConfig.model}失败：`, error);
          }
          return null;
        }
      }

      async function reFileName(originalFolderName, originalFileList) {
        console.log("正在翻译文件名");

        const aiConfig = {
          deepseek: {
            apikey: config.deepseekapikey,
            url: "https://api.deepseek.com/v1/chat/completions",
            model: "deepseek-chat",
            systemPrompt: `影视命名助手。严格按输入顺序翻译文件名。
                    输入：文件名列表（传入时用逗号分隔的字符串）
                    任务：将每个文件名翻译成标准格式，保持原有顺序

                    规则：
                    - 删除发布组信息，转为通用影视名
                    - 文件命名格式：影视名 (开播年份) SxxExx 分辨率 字幕
                    - 示例输入：'[Nekomoe kissaten][Sousou no Frieren][01][1080p][JPSC].mp4,[Nekomoe kissaten][Sousou no Frieren][02][1080p][JPSC].mp4'
                    - 示例输出：'葬送的芙莉莲 (2024) S01E12 1080p 简日内封,葬送的芙莉莲 (2024) S01E11 1080p 简日内封'

                    重要要求：
                    1. 输出格式必须是纯逗号分隔的字符串
                    2. 输出顺序必须与输入顺序完全一致
                    3. 只输出翻译后的名称，用英文逗号连接
                    4. 不要添加任何额外文字、空格或换行
                    5. 如果无法确定年份，用 (年份未知) 代替

                    示例：
                    输入：'[Airota][Anime][12][1080p].mp4,[Airota][Anime][11][1080p].mp4'
                    输出：'葬送的芙莉莲 (2024) S01E12 1080p 简日内封,葬送的芙莉莲 (2024) S01E11 1080p 简日内封'`,
          },
          qwen: {
            apikey: config.qwenapikey,
            url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            model: "qwen3-max",
            systemPrompt: `影视命名助手。输入(文件夹名, 文件名)，输出标准名。
                    规则：
                    1. 转通用名，删发布组/广告
                    2. 文件夹：影视名 (开播年份) 全X话 分辨率 字幕
                    3. 文件：影视名 (开播年份) SxxExx 分辨率 字幕
                    4. 示例：葬送的芙莉莲 (2026) S02E01 2160p 简日双语内封
                    5. 有文件夹则仅翻译文件夹名称，无则翻译文件名称。只输出一个名称
                    6. 灵活变通，电影/剧场版，可以不加“全X话”“SxxExx”总要求简洁明了，有关键信息，不确定的名称用原名
                    7. 请联网查询`,
          },
        };
        try {
          let nowAIConfig;
          if (config.aiProvider === "deepseek") {
            nowAIConfig = aiConfig.deepseek;
          } else if (config.aiProvider === "qwen") {
            nowAIConfig = aiConfig.qwen;
          }
          const newName = await fetchAI(
            nowAIConfig,
            originalFolderName,
            originalFileList.toString(),
          );
          console.log(originalFileList.toString());
          
          if (originalFolderName) {
            const reNameBtn = await waitElement(".icon-write", config.timeout);
            const clickEvent_1 = new Event("click");
            reNameBtn.dispatchEvent(clickEvent_1);
            const reNameTextarea = await waitElement(
              ".el-textarea__inner",
              config.timeout,
            );
            const inputEvent = new InputEvent("input");
            reNameTextarea.value = newName;
            reNameTextarea.dispatchEvent(inputEvent);
            const clickEvent_2 = new Event("click");
            reNameBtn.dispatchEvent(clickEvent_2);
          } else {
            const changeName = newName.split(",")
            console.log(changeName);
            
            const reNameRow = await waitElement(".el-tree-node", config.timeout,null,true);
            console.log(reNameRow);
            
            for (let i = 0; i < reNameRow.length; i++) {
              const clickEvent_1 = new Event("click");
            reNameRow[i].querySelector(".icon-write").dispatchEvent(clickEvent_1);
            const reNameTextarea = await waitElement(
              ".file_name_input",
              config.timeout
            );
            console.log(`第${i}次执行`,reNameTextarea.value,changeName[i]);
            
            const inputEvent = new InputEvent("input");
            reNameTextarea.value = changeName[i];
            reNameTextarea.dispatchEvent(inputEvent);
            const comfirmElement = await waitElement(
              ".confirm_icon",
              config.timeout,
            );
            console.log(comfirmElement);
            const clickEvent_2 = new Event("click");
            comfirmElement.dispatchEvent(clickEvent_2);
             await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            
            
          }
        } catch (error) {
          console.error("翻译名称失败：", error);
        }
      }

      // 开始下载
      async function startDownload() {
        try {
          const startDownloadElement = await waitElement(".task-parse-btn");
          const comfirm = new Event("click");
          startDownloadElement.dispatchEvent(comfirm);
        } catch (error) {
          console.error("开始下载失败：", error);
        }
      }

      // 动态获取元素
      async function waitElement(selector, timeoutMs, observeSelector, isAll) {
        let element;
        return new Promise((resolve, reject) => {
          isAll
            ? (element = document.querySelectorAll(selector))
            : (element = document.querySelector(selector));
          if (element) {
            resolve(element);
            return;
          }

          // 注册动态监听事件
          const observer = new MutationObserver((MutationsList) => {
            isAll
              ? (element = document.querySelectorAll(selector))
              : (element = document.querySelector(selector));
            if (element) {
              clearTimeout(timeoutId);
              observer.disconnect();
              resolve(element);
            }
          });
          // 启用动态监听
          observer.observe(
            observeSelector
              ? document.querySelector(observeSelector)
              : document.body,
            { childList: true, subtree: true },
          );

          const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`等待元素超时:${selector}`));
          }, timeoutMs);
        });
      }

      await addNewTag();
      await fullInlink();
      const [folderName, fileNameList] = await GetFileName();
      const newName = await reFileName(folderName, fileNameList);
      console.log(folderName);
      console.log(fileNameList);
      console.log(newName);
      await startDownload();
    },
    args: [config, link],
  });
}

// 打开Nas迅雷页面
async function openPage() {
  try {
    let queryUrl;
    const config = await getConfig();
    console.log(config);

    async function waitPageLoad(tabId) {
      return new Promise((resolve, reject) => {
        chrome.tabs.onUpdated.addListener((Id, changeInfo) => {
          const timeoutId = setTimeout(() => {
            clearTimeout(timeoutId);
            reject("页面加载超时！");
          }, config.timeout);
          if (Id === tabId && changeInfo.status === "complete") {
            resolve("页面加载完成！");
          }
        });
      });
    }

    if (config) {
      queryUrl = config.xunleiUrl.replace("#/home", "*");
      const existingTabs = await chrome.tabs.query({ url: queryUrl });
      if (existingTabs.length > 0) {
        // 打开则切换页面
        await chrome.tabs.update(existingTabs[0].id, { active: ifEntern });
        await chrome.tabs.reload(existingTabs[0].id);
        await waitPageLoad(existingTabs[0].id);
        return existingTabs[0].id;
      } else {
        // 未打开则新建页面
        const tab = await chrome.tabs.create({
          url: config.xunleiUrl,
          active: ifEntern,
        });
        await waitPageLoad(tab.id);
        return tab.id;
      }
    }
  } catch (error) {
    console.log("打开迅雷界面失败：", error);
  }
}
