import '@fontsource/noto-serif-tc/400.css';
import '@fontsource/noto-serif-tc/700.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

// LINE 內建瀏覽器的紀錄跟手機瀏覽器分開，關掉常會被清。網址帶 openExternalBrowser=1 時
// LINE 會改用手機預設瀏覽器開（LINE Developers〈Using LINE features with the LINE URL scheme〉）。
// 從內建瀏覽器內轉址是否同樣有效沒有查到官方說明；沒效時只是多一次重新整理，畫面上另有提示。
const here = new URL(location.href);
if (/\bLine\//.test(navigator.userAgent) && !here.searchParams.has('openExternalBrowser')){
  here.searchParams.set('openExternalBrowser', '1');
  location.replace(here.href);
}

mount(App, { target: document.getElementById('app') });
