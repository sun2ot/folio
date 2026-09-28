import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './resume.css';
import { fontCSS } from './fonts';

const fontStyle = document.createElement('style');
fontStyle.textContent = fontCSS;
document.head.append(fontStyle);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
