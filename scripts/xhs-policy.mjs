const bannedHtml = /\son\w+\s*=|javascript:|<\s*(?:iframe|object|embed|form)\b|\bdownload\b|\btarget\s*=\s*["']_blank["']|\brel\s*=\s*["']manifest["']/i;
const externalMarkupResource = /(?:src|href|xlink:href)\s*=\s*["'](?:https?:)?\/\//i;

const bannedJavaScript = [
  ['网络与实时通信', /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|RTCDataChannel)\b/],
  ['动态代码或 WASM', /\beval\s*\(|\b(?:new\s+)?Function\s*\(|\bWebAssembly\b/],
  ['Worker', /\b(?:Worker|SharedWorker)\s*\(|navigator\.serviceWorker\b/],
  ['定位、剪贴板或凭据', /navigator\.(?:geolocation|clipboard|credentials|locks)\b|document\.execCommand\s*\(\s*["'](?:copy|cut|paste)["']/],
  ['硬件或传感器', /navigator\.(?:bluetooth|usb|hid|serial)\b|\b(?:DeviceMotionEvent|DeviceOrientationEvent|AmbientLightSensor|Accelerometer|Gyroscope|Magnetometer|AbsoluteOrientationSensor)\b/],
  ['屏幕或设备信息', /\b(?:requestFullscreen|getDisplayMedia)\b|navigator\.(?:getBattery|connection|mediaDevices)\b/],
  ['持久化或跨域存储', /navigator\.storage\.(?:persist|persisted)\b|document\.requestStorageAccess\b/],
  ['窗口能力', /\b(?:window\.)?(?:open|prompt)\s*\(/],
  ['移动 WebView 不支持能力', /\b(?:PaymentRequest|PushManager|NDEFReader|SyncManager)\b|Notification\.requestPermission\b|\bnew\s+Notification\b|navigator\.(?:requestMIDIAccess|xr|keyboard)\b|\brequestPointerLock\b/],
  ['动态嵌入或表单', /createElement\s*\(\s*["'](?:iframe|object|embed|form)["']|\.submit\s*\(\s*\)/],
  ['文件下载', /\.download\s*=|setAttribute\s*\(\s*["']download["']/]
];

function hasProtocolRelativeUrlLiteral(source) {
  let index = 0;
  while (index < source.length) {
    if (source[index] === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    const quote = source[index];
    if (quote !== '"' && quote !== "'" && quote !== '`') {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < source.length && source[end] !== quote) {
      end += source[end] === '\\' ? 2 : 1;
    }
    if (/^[ \t\r\n]*\/\//.test(source.slice(index + 1, end))) return true;
    index = end + 1;
  }
  return false;
}

export function assertCompliantHtml(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length || scripts.some((match) => {
    return !/\bsrc=["'][^"']+["']/i.test(match[1]) || match[2].trim() !== '';
  })) {
    throw new Error('所有脚本必须通过包内 src 外置引用，script 标签体必须为空');
  }
  if (bannedHtml.test(html)) throw new Error(`入口包含禁用 HTML：${bannedHtml.exec(html)[0]}`);
  if (externalMarkupResource.test(html)) throw new Error('入口包含外部资源引用');
}

export function assertCompliantJavaScript(source) {
  for (const [label, pattern] of bannedJavaScript) {
    const match = pattern.exec(source);
    if (match) throw new Error(`脚本包含禁用能力（${label}）：${match[0]}`);
  }
  const withoutSvgNamespace = source.replaceAll('http://www.w3.org/2000/svg', '');
  if (/https?:\/\//i.test(withoutSvgNamespace) || hasProtocolRelativeUrlLiteral(withoutSvgNamespace)) {
    throw new Error('脚本包含外部网络地址');
  }
}

export function assertCompliantMarkup(markup, label) {
  if (externalMarkupResource.test(markup)) throw new Error(`${label} 包含外部资源引用`);
}

export function assertCompliantCss(css) {
  if (/url\(\s*["']?(?:https?:)?\/\//i.test(css) || /@import\b/i.test(css)) {
    throw new Error('样式包含外部资源');
  }
}
