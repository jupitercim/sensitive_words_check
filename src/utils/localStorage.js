export async function getSensitiveWords() {
    const sensitiveWordList = await chrome.storage.local.get("sensitiveWordList")
    return sensitiveWordList;
}

export async function setLocalStorage(key, value) {
    await chrome.storage.local.set({[key]: value});
}


export async function getLocalStorage(key) {
    const result = await chrome.storage.local.get(key)
    return result;
}



