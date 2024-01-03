import { isValidUrl } from "@/utils/common";

let timeout = 7000;
let taskScreenShotFlag = false;
let taskIgnoreUrl = [];
let taskDuplicatePage = [];
let lastUrlError = {};
// 用来记录重定向的url关系
let redirectUrlMap = {};
// 用来记录task的host地址,用来判断深度
let taskHost = "";
// autoRunTab 表示的是新开的tab的id
let autoRunTab = "";
// 用来表示是否开启了自动扫描功能
let autoRunFlag = false;
let autoPort;
// 用于记录总共的url
let autoScanPaths = [];
// 用来记录已经处理过的url
let autoScanPathsDone = [];
// 页面截图
let pageScreenShot = {};
// 用来存放分析结果
let checkResult = {};
let pendingRequests = {};
let sensitiveWordList = [];
let checkTypes = ['xhr', 'fetch', 'stylesheet', 'document', 'script'];
// 中文注释检测
let chineseAnnotationDetectionFlag = false;
// 敏感词检测标志
let sensitiveWordDetectionFlag = false;


chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    const {action, tab} = request;
    if(autoRunFlag){
        sendResponse({"error": "auto scan is running, please stop it first."})
    }
    if (action === "modifySensitiveWordList") {
        oldSensitiveWordList = sensitiveWordList;
        sensitiveWordList = request.sensitiveWordList;
        await chrome.storage.local.set({"sensitiveWordList": sensitiveWordList})

    }
    // sendResponse("content got!")
})

// 添加Connect来接收和处理AutoScan的消息
chrome.runtime.onConnect.addListener(function(port) {
    autoPort = port;

    port.onMessage.addListener(function(message) {
        if(message.action === "startAuto"){
            const { path, auto} = message;
            const initStatus = initAutoRun(message);
            if(initStatus===false){
                return;
            }

            let startCheckListenerFlag = true;
            let errorOccurred = false;
            chrome.tabs.create({url: path}, function (tab) {
                const listener = details => {
                    if (details.tabId === tab.id && details.type === 'main_frame' && startCheckListenerFlag) {
                        chrome.webRequest.onErrorOccurred.removeListener(listener);
                        errorOccurred = true;
                        console.log(details)
                        port.postMessage({"error": "please check the url is correct."});
                    }
                };
                chrome.webRequest.onErrorOccurred.addListener(listener, { urls: ['<all_urls>'] });
                // 如果页面创建成功,则添加debugger
                autoRunTab = tab.id;
                const onUpdatedListener = (id, info, updatedTab) => {
                    if (id === tab.id && info.status === 'complete' && !errorOccurred) {
                        startCheckListenerFlag = false;
                        chrome.tabs.onUpdated.removeListener(onUpdatedListener);
                        // 如果没有发生onErrorOccurred事件，添加debugger
                        chrome.debugger.attach({tabId: tab.id}, '1.2', function() {
                            if (chrome.runtime.lastError) {
                                port.postMessage({"error": chrome.runtime.lastError});
                            } else {
                                // Debugger attached, now do something with it
                                chrome.debugger.sendCommand({tabId: tab.id}, 'Network.enable');
                                // 1.刷新当前页,因为我们是在page完全load后才开始添加的debugger,所以这里刷新一下
                                chrome.tabs.reload(tab.id, {bypassCache: true}, function () {
                                    autoScanPaths.push(modifyUrl(path));
                                    autoScanPaths = unique(autoScanPaths);
                                });
                                if(!autoRunFlag){
                                    setTimeout(()=>{
                                        autoPort.postMessage({"action": "finish"})
                                        autoPort.postMessage({"action": "finalResult", "finalResult": checkResult});
                                    },timeout);
                                }
                            }
                        });
                    }
                };
                chrome.tabs.onUpdated.addListener(onUpdatedListener);
                // 发送消息告诉内容脚本开始扫描
            });
        }else if(message.action === "stopAuto"){
            // 停止自动扫描, tabid是新打开的tabID
            autoRunFlag = false;
            console.log("stopAuto debugger detach")
            // 因为可能手动停止,还需要在手工执行,所以就不detach
            // chrome.debugger.detach({tabId: autoRunTab});
            // 还需要将截图发送给content脚本,对应
            autoPort.postMessage({"action": "finish", "pageUrls": pageUrls, "screenShot": pageScreenShot })
            autoRunTab = "";
            autoPort.postMessage({"action": "finalResult","finalResult": checkResult});
        }else{
            port.postMessage({"error": "unknown action"});
        }
    });
});

chrome.debugger.onEvent.addListener(async function (source, method, params) {
    // console.log("chrome.debugger.onEvent.addListener(", source, method, params)
    if (method === 'Network.responseReceived') {
        if (checkTypes.includes(params.type.toLowerCase())) {
            pendingRequests[params.requestId] = { status: true, type: params.type, url: params.response.url };
        }
        // 这里可以已经处理过的url
    } else if (
        method === 'Network.loadingFinished' &&
        pendingRequests[params.requestId] !== undefined
    ) {
        // 重复请求不在做处理
        const index = pendingRequests[params.requestId].url + '_' + pendingRequests[params.requestId].type;
        // console.log("checkResult:", checkResult)
        if (checkResult[index] !== undefined) {
            return;
        }else{
            // 检查loadingFinished的请求params.type是否是Document,如果是的话需要分析a标签,获取新的url
            // 这里写成异步也没有成功只能在内部处理了
            dealResponseBody(source.tabId,
                params.requestId,
                pendingRequests[params.requestId])
        }
        delete pendingRequests[params.requestId];
    }else{
        // console.log("do nothing", source, method, params)
    }
});

// 只是用来获取response的body,不做任何处理
async function  dealResponseBody(tabId, requestId, requestInfo) {
    // 先获取response
    chrome.debugger.sendCommand(
        {tabId: tabId},
        'Network.getResponseBody',
        {requestId: requestId},
        async function (response) {
            if(response.body===undefined){
                // Todo
                console.log("dealResponseBody response.body is undefined", requestInfo)
            }
            const body = response.body;
            // 这里可以通过传入的requestInfo来判断是否是document,如果是的话,就需要分析a标签,获取新的url
            if(autoRunFlag && requestInfo.type == "document"){
                parseLink(body);
            }
            // 检查是否存在关键字
            if(sensitiveWordDetectionFlag){
                await checkV2(tabId, requestInfo.url, body, sensitiveWordList, requestInfo.type);
            }

            if(chineseAnnotationDetectionFlag){
                await checkChineseAnnotation(tabId, requestInfo.url, body, requestInfo.type);
            }
            
        });
}



/**
 * 返回两个维度数据, 一个是以url返回,一个是以关键字返回
 * {
 *  url: [{'word':word,'hit': hit, 'result': result},{}],
 *  words: {'word1':{'url': url, 'hit': hit, 'result': result}, 'word2':{}}'}
 * }
 * @param {*} content 
 * @param {*} words 
 */
async function checkV2(tabId, url, content, words, type){
    const returnResult = {"url":[], "words":{}}
    const pageUrl = await getTabUrl(tabId);
    words.forEach((word, index) => {
        let searchTerm = word ;
        let regex = new RegExp(".{0,5}" + searchTerm + ".{0,5}", "ig");
        let matches = content.match(regex);
        // console.log("matches:", matches, "matches===null:", matches === null)
        let flag = false;
        if(matches === null){
            matches = []
        }else{
            if(matches.length===0){
                flag = false;
            }else{
                flag = true;
            }
        }
        returnResult["words"][word] = {'page': pageUrl, 'url': url, 'word': word,  'hit': flag, 'type': type,'result': matches };
        returnResult["url"].push({'page': pageUrl, 'url': url, 'word':word,'hit': flag, 'type': type,'result': matches})
        setFinnalResult(word, {'page': pageUrl, 'url': url, 'word': word,  'hit': flag, 'type': type,'result': matches });
    })
    autoPort.postMessage({"action": "checkResult", "checkResult": returnResult});
}

// 由于现在有一个react的频繁更新导致数据丢失的问题还不知道怎么解决,就先把结果存到本地,完成后统一在发送一次
async function checkChineseAnnotation(tabId, url, content,type){
    // (//.*?$(|/\*.*?\*/))* // 匹配注释
    // console.log("checkChineseAnnotation start:", url)

    let word = "Chinese Annotation Detection";
    const pageUrl = await getTabUrl(tabId);
    let regex = new RegExp("(/\\*[^\\*/]*\\*/)|(^//.*)", "ig");
    let matches = content.match(regex);
    // console.log("chineseAnnotationDetectionFlag:", matches);
    const returnResult =  {"url":[], "words":{}};
    const result = [];
    let flag = false;
    if(matches === null){

    }else{
        matches.forEach((item, index) => {
            if(hasChinenese(item)){
                flag = true;
                result.push(item);
            }
        })
        // console.log("chineseAnnotationDetection result:", result);
        returnResult["words"][word] = {'page': pageUrl, 'url': url, 'word': word,  'hit': flag, 'type': type,'result': result };
        returnResult["url"].push({'page': pageUrl, 'url': url, 'word':word,'hit': flag, 'type': type,'result': result})
        autoPort.postMessage({"action": "checkResult", "checkResult": returnResult});
        setFinnalResult(word, {'page': pageUrl, 'url': url, 'word': word,  'hit': flag, 'type': type,'result': result });
        // chrome.storage.local.set({"checkResult": checkResult})
        
    }
}

function setFinnalResult(word, result) {
    if(checkResult[word]===undefined){
        checkResult[word] = [];
    }
    checkResult[word] = [...checkResult[word], result];
    // chrome.storage.local.set({"checkResult": checkResult})
}

function hasChinenese(str) {
    return /[\u4E00-\u9FA5]+/g.test(str); 
}

async function getTabUrl(id) {
    const tab = await chrome.tabs.get(id);
    return tab.url;
}

function unique (arr) {
    return Array.from(new Set(arr))
}

function parseLink() {
    console.log("parseLink")
}

/**
 * 这里是用于处理页面加载完成, 如果页面加载完成,我们可以进行截图,并且分析页面中的a标签,获取新的url
 */
let pageUrls = {}
chrome.webRequest.onCompleted.addListener(
    async function(details) {
        if(autoRunFlag===false){
            // 如果不是自动扫描,这里就不需要处理了
        }else{
            if(details.statusCode > 400 && details.tabId=== autoRunTab && details.type === 'main_frame' && isValidUrl(details.url) ){
                // 当前url可能是错误的
                autoPort.postMessage({"action": "checkResult", "checkResult": {"page": details.url, "url": details.url, "type": "Document", "hit": false, "result": "", "remark": "page load failed"}, "extra": "main_frame error"}, );
                autoScanPathsDone.push(modifyUrl(details.url));
                autoScanPathsDone = unique(autoScanPathsDone);
                visitNextUrl();
            }
            if (details.type === 'main_frame' && details.tabId == autoRunTab && isValidUrl(details.url)) {
                console.log('网页加载完成: ' + details.url);
                
                setTimeout(()=>{
                    chrome.scripting.executeScript({
                        target: {tabId: autoRunTab},
                        function: () => {return document.documentElement.innerHTML;} 
                        }, async (html) => {
                            try{
                                
                                // 如果不符合host的,就不在收集这个页面的url
                                details.url = modifyUrl(details.url);
                                    // 页面加载完成后截图格式为base64
                                    await captureTabScreenshot(autoRunTab, details.url);
                                if(isHost(details.url, taskHost)){
                                    const aList = html[0].result.match(/<a.*?href="(.*?)".*?>(.*?)<\/a>/ig);
                                    // 讲当前页面的所有a标签的href提取出来,并且去重
                                    const hrefList = aList.map((item) => {
                                        return item.match(/href="(.*?)"/)[1];
                                    })
                                    // 这里还需要处理一下,如果不是有效的url,则需要剔除, 并且需要处理一下末位的/ ,防止 123/ 和123不相等的的情况
                                    // 需要去除一些特殊的链接, 比如说https://accounts.commex.com/en/login?return_to=aHR0cHM6Ly93d3cuY29tbWV4LmNvbS9lbi9mdXR1cmVzLWluZm8vZnVuZGluZy1oaXN0b3J5LzA%253D
                                    // 因为这个return_to后面的是会实时变化,每次页面刷新都会变化,导致任务url会不断增加,所以需要去除这种url
                                    // TODO 
                                    // 还需要处理一些只请求一次的url, 比如trade/BTC_USDT 和trade/BTC_ETH 这种,这个可以前端给一个配置项,用于正则表达式匹配,只执行一次的page
                                    
                                    const dealedUrlList = modifyUrlList(filterNotValidUrl(hrefList))
                                    // console.log("ddebug:", dealedUrlList)
                                    autoScanPaths = autoScanPaths.concat(dealedUrlList);
                                    autoScanPaths = unique(autoScanPaths);
                                    console.log("details.url", details.url)
                                    pageUrls[details.url] = filterNotValidUrl(dealedUrlList);
                                }else{
                                    console.log("不是当前host的url,不做处理", details.url, taskHost)
                                }
                                // 不符合的和复合host的至少都要走一遍
                                autoScanPathsDone.push(modifyUrl(details.url));
                                autoScanPathsDone = unique(autoScanPathsDone);

                                // 去除特定的href
                                // console.log("pageUrls:", pageUrls)
                                // autoScanPaths = ["http://VIP@commex.com"]
                                visitNextUrl();
                            }catch(error)  {
                                console.log("error:", error)
                                if (lastUrlError[details.url] === undefined) {
                                    lastUrlError[details.url] = 1;
                                } else {
                                    lastUrlError[details.url] += 1;
                                    if(lastUrlError[details.url]>=3){
                                        autoScanPathsDone.push(modifyUrl(details.url));
                                        autoScanPathsDone = unique(autoScanPathsDone);
                                        // autoPort.postMessage({"error": `${details.url} error, please check it manually.`});
                                        autoPort.postMessage({"action": "checkResult", "checkResult": {"page": details.url, "url": details.url, "type": "Document", "hit": false, "result": "", "remark": "page load failed"}, "extra": "main_frame error"}, );

                                        // 将结果推送到内容脚本
                                        visitNextUrl();
                                    }else{
                                        chrome.tabs.update( autoRunTab, {url: details.url}, function (tab) {});
                                    }
                                }
                            }
                        }
                    );
                }, 3000);
            }
        }

    },
    {urls: ['<all_urls>']}
);

function visitNextUrl() {
    if(autoRunFlag===false){
        if(autoPort){
            autoPort.postMessage({"error": "auto run is stopped."})
        }
        return;
    }
    if(autoPort){
        autoPort.postMessage({"action": "process", "done": autoScanPathsDone.length, "total": autoScanPaths.length})
    }
    // 比较autoScanPathsDone和autoScanPaths,比较俩个list的差异,取出差异的第一个url,然后跳转到这个url
    let difference = autoScanPaths.filter(x => !autoScanPathsDone.includes(x));
    let nextUrl = difference.shift();
    while(true){
        if(nextUrl===undefined&&difference.length===0){
            setTimeout(()=>{
                autoPort.postMessage({"action": "finish", "pageUrls": pageUrls, "screenShot": pageScreenShot })
                // 
                console.log("finnal result localhost:", checkResult)
                autoPort.postMessage({"action": "finalResult","finalResult": checkResult});
                console.log("autoScanPaths:", autoScanPaths, "autoScanPathsDone:", autoScanPathsDone);
                autoRunFlag = false;
                // 目标页 alert告诉用户结束了
                chrome.scripting.executeScript({target: {tabId: autoRunTab}, function: () => {alert("auto scan finished!")}}, ()=>{});
            },timeout);
            break;
        }else if(!isHost(nextUrl, taskHost)){
            autoScanPathsDone.push(modifyUrl(nextUrl));
            autoScanPathsDone = unique(autoScanPathsDone);
            // 这里需要更新process,不然处理完了,进度条还是不是100%
            autoPort.postMessage({"action": "process", "done": autoScanPathsDone.length, "total": autoScanPaths.length})
            nextUrl = difference.shift();
        }else{
            console.log("nextUrl", nextUrl)
            setTimeout(()=>{chrome.tabs.update( autoRunTab, {url: nextUrl}, function (tab) {
                // console.log("update tab", tab)
                autoScanPaths = autoScanPaths.map((item) => {
                    if(item===modifyUrl(tab.pendingUrl)){
                        return modifyUrl(tab.url);
                    }else{
                        return item;
                    }
                })
            })}, 3000);
            break;
        }
    }
}

function initAutoRun(taskInfo) {
    const {words, path, host, auto, screenShotFlag, duplicatePage, ignoreUrl, tasks} = taskInfo;
    console.log("initAutoRun:", taskInfo)
    taskScreenShotFlag = screenShotFlag;
    taskDuplicatePage = duplicatePage;
    taskIgnoreUrl = ignoreUrl;
    taskHost = host;
    redirectUrlMap = {};
    autoRunTab = "";
    autoRunFlag = auto;
    autoScanPaths = [];
    autoScanPathsDone = [];
    checkResult = {};
    pendingRequests = {};
    sensitiveWordList = words;
    if(tasks.includes("Words_Check")){
        sensitiveWordDetectionFlag = true;
    }
    if(tasks.includes("Chinese_Annotation_Detection")){
        console.log("init Chinese_Annotation_Detection")
        chineseAnnotationDetectionFlag = true;
    }
    if(tasks==[]){
        autoPort.postMessage({"action": "initError", "error": "please select at least one task."})
        return false;
    }
    return true;
}

function afterStop() {
    sensitiveWordDetectionFlag = false;
    chineseAnnotationDetectionFlag = false;
}

function filterNotValidUrl(arr) {
    return arr.filter((item) => {
        return isValidUrl(item);
    })
}

function getUrlWithoutParams(url) {
    let urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
}

function isHost(url, host) {
    if(host==""){
        return true;
    }else{
        console.log("getHost", getHost(url))
        return getHost(url).indexOf(host) !== -1;
    }
}

function getHost(url) {
    let urlObj = new URL(url);
    return urlObj.host;
}

// 
function modifyUrlList(arr) {
    return arr.map((str) => {
        return modifyUrl(str);
    })
}

function modifyUrl(str) {
    let dealStr = getUrlWithoutParams(str);
    if (dealStr[dealStr.length - 1] === '/') {
        // 这里需要去除末尾的/
        return dealStr.substring(0, dealStr.length - 1);
    } else {
        return dealStr;
    }

}

async function captureTabScreenshot(tabId, url) {
    if(taskScreenShotFlag===false){
        return;
    }
    // 首先激活标签页
    await chrome.tabs.update(tabId, {active: true}, async function() {
        // 然后截取屏幕截图
        try{
            await chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
                console.log("captureTabScreenshot:", dataUrl)
                pageScreenShot[url] = dataUrl;
            });
        }catch(e){
            console.log("captureTabScreenshot error:", e)
        }
    });
}





