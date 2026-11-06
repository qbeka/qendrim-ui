import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@qbeka/react/styles.css';
import { App } from './App';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
