export function isValidUrl(string) {
    // 判断string是否是一个http或者https的url
    // 用于判断用户输入的url是否合法
    try {
        if(string.startsWith("http://") || string.startsWith("https://")){}else{return false;} 
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

export function getPathWithoutParams(url) {
    let urlObj = new URL(url);
    return urlObj.pathname;
}


export function getHost(url) {
  let urlObj = new URL(url);
  return urlObj.host;
}