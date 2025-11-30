let link = ""
let webId
let webUrl

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "PCToNASMenu",
    title: "发送到NAS",
    contexts: ["link"]
    })
})

// 监听右键菜单点击事件
    chrome.contextMenus.onClicked.addListener((info) => {

        //获取指向元素的链接
        if (info.linkUrl) {
          link = info.linkUrl 
        }

        //运行
        run()
    })

function run(){
  let queryUrl
  chrome.storage.sync.get(["xunleiUrl"],(result) => {
    // 判断是否已经打开了迅雷下载页
    if (result.xunleiUrl) {
      // 去除网址hash值
      queryUrl = result.xunleiUrl.replace("#/home","*")
      console.log(queryUrl);

      chrome.tabs.query({url:queryUrl},(tabs) => {
        if (tabs.length > 0) {

        console.log(tabs);
        chrome.tabs.update(tabs[0].id,{active:true})
        chrome.tabs.reload(tabs[0].id)
        webId = tabs[0].id
        setTimeout(action,200)
          
        }else{

        // 从同步存储中调用迅雷界面网址 
        chrome.storage.sync.get(["xunleiUrl"],(result) => {
          if (result.xunleiUrl) {
            chrome.tabs.create({url:result.xunleiUrl,active:true}).then((tab => {
              webId = tab.id
              console.log(tab.id);
              // 当页面加载完成后执行
              chrome.tabs.onUpdated.addListener(pageListener = (tabId,changeInfo,tab) => {
                console.log(changeInfo.status);
                
                if (changeInfo.status === "complete" && tabId === webId) {
                  console.log("加载完成")
                  setTimeout(action,200)
                }
              })
            }))
          }else{
            // alert("请设置迅雷url");
          }
        })
        }
      })
    }else{
      alert("请设置迅雷Url")
    }
  })
  

  
}

// 模拟操作函数
function action(){
  chrome.scripting.executeScript({
    target:{tabId:webId},
    func: (link) =>{
      const timeout = 3000
      const interTime = 300
     
      
      
      // 新建任务
      addNewTag()
      // 填充连接和确认
      fullInlink()
      // 开始下载
      startDownload()
      
      
      // 填充链接与确认链接

      //打开新建任务界面
      function addNewTag() {
        timeOutCheck(() => {
          if (document.querySelector(".create__task")) {
            // 新建事件
            const addTag = document.querySelector(".create__task")
            const addTagEvent = new Event("click",{bubbles:true})
            
            // 执行事件
            addTag.dispatchEvent(addTagEvent)
            return true
          }else{
            return false
          }
        },timeout,interTime,"addNewTag")
      }

      // 填充链接与确认
      function fullInlink() {
         timeOutCheck(() => {
            if (document.querySelector(".el-textarea__inner")) {

              const InputEvent = new Event("input",{bubbles: true})
              const comfirm = new Event("click",{bubbles:true})

              document.querySelector(".el-textarea__inner").value = link
              document.querySelector(".el-textarea__inner").dispatchEvent(InputEvent)
              document.querySelector(".task-parse-btn").dispatchEvent(comfirm)

              return true
            }else{
              return false
            }
         },timeout,interTime,"fullInlink")
      }

      // 开始下载
      function startDownload(){
          timeOutCheck(() => {
            if (document.querySelector(".task-parse-btn span").innerText == "立即下载" && document.querySelector(".result-nas-task-dialog")) {

              const comfirm = new Event("click",{bubbles:true})

              document.querySelector(".task-parse-btn").dispatchEvent(comfirm)

              return true
              
            }else{
              return false
            }
          },timeout,interTime,"startDownload")
      }
        
      // 执行任务超时检测
      function timeOutCheck(func,timeoutMs,InterMs,funcname){
        let times = 0
        
        const timer = setInterval(() => {
          times++
          if (times <= timeoutMs/InterMs) {
            const result = func()
            if (result) {
              console.log(`第${times}次执行${funcname}时成功`);
              clearInterval(timer)
            }else{
              console.log(`第${times}次执行${funcname}时失败`);
            }
          }else{
            console.log(`执行${func.name}函数超时`);
            clearInterval(timer)
            
          }
        },InterMs)
      }

    },
    args:[link]
  })
}



