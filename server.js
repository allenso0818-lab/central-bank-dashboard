const http=require("http"),fs=require("fs"),path=require("path");
const port=Number(process.env.PORT||3000),root=__dirname;
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml"};
const server=http.createServer((req,res)=>{
 let pathname=decodeURIComponent((req.url||"/").split("?")[0]);
 if(pathname==="/favicon.ico"){res.writeHead(204);return res.end();}
 if(pathname==="/")pathname="/index.html";
 const file=path.normalize(path.join(root,pathname));
 if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden");}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found");}
  res.writeHead(200,{"Content-Type":types[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});
  res.end(data);
 });
});
server.listen(port,"0.0.0.0",()=>console.log("Dashboard running on "+port));