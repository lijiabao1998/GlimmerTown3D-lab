// Vite 的 ?raw 匯入（D003 把樣本分享碼當字串內嵌進單檔）
declare module '*?raw' {
  const text: string;
  export default text;
}
