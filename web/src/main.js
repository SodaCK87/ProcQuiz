import '@fontsource/noto-serif-tc/400.css';
import '@fontsource/noto-serif-tc/700.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });
