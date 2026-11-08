import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const root = document.documentElement;
addEventListener('keydown', (event) => {
  if (event.key === 'Tab') root.dataset.keyboard = '';
}, true);
addEventListener('pointerdown', () => delete root.dataset.keyboard, true);

mount(App, { target: document.getElementById('app')! });
