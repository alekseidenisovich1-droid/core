import { defineConfig } from 'vite';
export default defineConfig({
  clearScreen:false,
  // Cargo continually replaces its temporary build executables. Watching that
  // output on Windows can produce EBUSY and stop the Vite side of `tauri dev`.
  server:{
    port:1420,strictPort:true,host:'127.0.0.1',
    watch:{ignored:['**/src-tauri/target/**']},
  },
});
