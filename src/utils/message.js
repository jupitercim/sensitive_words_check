import {notification} from 'antd'

export function sendSensitiveWordListMessage(sensitiveWordList) {
    chrome.runtime.sendMessage({"action": "modifySensitiveWordList", "sensitiveWordList":sensitiveWordList}, (response) => {
        // console.log("service发送response成功")
        // console.log(response)
    });
}

export function sendStartMessage(words, path) {
    chrome.runtime.sendMessage({"action": "startAuto", "words": words, "path": path}, (response) => {
        notification.open({
            message: 'start anto scan',
            description: `words: ${words}, path: ${path}`,
          });
    });
}

export function sendStopMessage() {
    chrome.runtime.sendMessage({"action": "stopAuto"}, (response) => {
        // notification.open({
        //     message: 'stop anto scan',
        //     description: 'please check task info config.',
        //   });
    });
}

