import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@qbeka/react/styles.css';
import { Page } from './Page';
import './project.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><Page /></StrictMode>);
