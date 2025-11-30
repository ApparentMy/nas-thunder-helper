let inputWebsite = document.querySelector(".input-website")
let save = document.querySelector(".save")

//初始化
window.onload=function(){
    chrome.storage.sync.get(["xunleiUrl"],(result) => {
        inputWebsite.value = result.xunleiUrl
    })
}

// 存储配置文件
save.addEventListener("click",function(e){
    chrome.storage.sync.set({xunleiUrl:inputWebsite.value},() => {
        alert('设置已保存');
    })
    
})