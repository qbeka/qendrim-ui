import { createRoot } from 'react-dom/client';
import { Button } from '@qbeka/react/button';
import '@qbeka/react/css/tokens.css';
import '@qbeka/react/css/button.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<Button>Only a button</Button>);
