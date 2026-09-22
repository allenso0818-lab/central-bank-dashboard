const http=require("http"),https=require("https"),fs=require("fs"),path=require("path");
const port=Number(process.env.PORT||3000),root=__dirname;
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml"};
function fred(req,res){
 const u=new URL(req.url,"http://localhost"),id=(u.searchParams.get("id")||"").toUpperCase();
 if(!/^[A-Z0-9_-]{1,40}$/.test(id)){res.writeHead(400);return res.end("Invalid series");}
 const target="https://fred.stlouisfed.org/graph/fredgraph.csv?id="+encodeURIComponent(id);
 https.get(target,{headers:{"User-Agent":"CentralBankDashboard/1.0","Accept":"text/csv"}},r=>{
   if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){res.writeHead(502);r.resume();return res.end("Upstream redirect");}
   if(r.statusCode!==200){res.writeHead(502);r.resume();return res.end("FRED unavailable");}
   res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Cache-Control":"public, max-age=1800","Access-Control-Allow-Origin":"*"});r.pipe(res);
 }).on("error",()=>{res.writeHead(502);res.end("FRED unavailable")});
}
const server=http.createServer((req,res)=>{
 if((req.url||"").startsWith("/api/fred?"))return fred(req,res);
 let pathname=decodeURIComponent((req.url||"/").split("?")[0]);
 if(pathname==="/favicon.ico"){res.writeHead(204);return res.end();}
 if(pathname==="/")pathname="/index.html";
 const file=path.normalize(path.join(root,pathname));
 if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden");}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found");}
  res.writeHead(200,{"Content-Type":types[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data);
 });
});
server.listen(port,"0.0.0.0",()=>console.log("Dashboard running on "+port));