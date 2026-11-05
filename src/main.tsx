import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/notifications';

// Initialize background service worker for closed tab and lock screen notification support
registerServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
