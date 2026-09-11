import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Older iPhones still in the family. Optional chaining and ?? are syntax
// errors before iOS 13.4, and a syntax error is a blank white page.
export default defineConfig({
  plugins: [react()],
  build: { target: ['es2017', 'safari11'] },
});
