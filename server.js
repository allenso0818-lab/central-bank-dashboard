const http=require("http"),fs=require("fs"),path=require("path");
const port=Number(process.env.PORT||3000);
function findIndex(){
  const candidates=[
    path.join(__dirname,"index.html"),
    path.join(process.cwd(),"index.html"),
    "/app/index.html",
    "/workspace/index.html"
  ];
  for(const f of candidates){try{if(fs.existsSync(f)) return f;}catch{}}
  return null;
}
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/favicon.ico"){res.writeHead(204);return res.end();}
  if(pathname!=="/" && pathname!=="/index.html"){
    res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found");
  }
  const index=findIndex();
  if(!index){
    console.error("index.html not found", {cwd:process.cwd(),dirname:__dirname,files:(()=>{try{return fs.readdirSync(process.cwd())}catch{return []}})()});
    res.writeHead(500,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Dashboard file missing");
  }
  fs.readFile(index,(err,data)=>{
    if(err){console.error(err);res.writeHead(500,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Dashboard read error");}
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"});
    res.end(data);
  });
});
server.listen(port,"0.0.0.0",()=>console.log("Dashboard running on "+port+" cwd="+process.cwd()+" index="+findIndex()));