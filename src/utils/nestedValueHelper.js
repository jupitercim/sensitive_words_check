export function getNestedValue(obj, path, splitChar) {
    return path.split(splitChar).reduce((o, key) => {
        return o && o[key] !== undefined ? o[key] : null
    }, obj)
}

export function setNestedValue(obj, path, value, splitChar) {
  let keys = path.split(splitChar);
  let lastKey = keys.pop();
  let deepObj = keys.reduce((o, key) => (o[key] = o[key] || {}), obj);
  deepObj[lastKey] = value;
}
