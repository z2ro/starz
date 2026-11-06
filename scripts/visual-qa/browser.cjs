const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function launch(){
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,env:Object.fromEntries(['PATH','HOME','LANG','DISPLAY','XDG_RUNTIME_DIR','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  // Playwright uses --remote-debugging-pipe, not a listening Chrome debugging TCP port.
  return browser;
}
module.exports={launch};
