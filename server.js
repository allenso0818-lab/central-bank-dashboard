const http=require("http"),https=require("https"),fs=require("fs"),path=require("path");
const port=Number(process.env.PORT||3000),root=__dirname;
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml"};
const cache=new Map();
function getHttps(url,cb,depth=0){
 if(depth>5)return cb(new Error("Too many redirects"));
 const r=https.get(url,{headers:{"User-Agent":"Mozilla/5.0 CentralBankDashboard/1.0","Accept":"text/csv,*/*"}},up=>{
  if(up.statusCode>=300&&up.statusCode<400&&up.headers.location){
   const next=new URL(up.headers.location,url).toString();up.resume();return getHttps(next,cb,depth+1);
  }
  if(up.statusCode!==200){up.resume();return cb(new Error("Upstream HTTP "+up.statusCode));}
  let chunks=[];up.on("data",x=>chunks.push(x));up.on("end",()=>cb(null,Buffer.concat(chunks)));
 });r.setTimeout(15000,()=>r.destroy(new Error("FRED timeout")));r.on("error",cb);
}
function fred(req,res){
 const u=new URL(req.url,"http://localhost"),id=(u.searchParams.get("id")||"").toUpperCase();
 if(!/^[A-Z0-9_-]{1,40}$/.test(id)){res.writeHead(400);return res.end("Invalid series");}
 const hit=cache.get(id);if(hit&&Date.now()-hit.time<1800000){res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Cache-Control":"public, max-age=1800"});return res.end(hit.data);}
 const target="https://fred.stlouisfed.org/graph/fredgraph.csv?id="+encodeURIComponent(id);
 getHttps(target,(err,data)=>{
  if(err){console.error("FRED",id,err.message);res.writeHead(502,{"Content-Type":"text/plain; charset=utf-8"});return res.end("FRED unavailable: "+err.message);}
  cache.set(id,{time:Date.now(),data});res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Cache-Control":"public, max-age=1800"});res.end(data);
 });
}
const server=http.createServer((req,res)=>{
 if((req.url||"").startsWith("/api/fred?"))return fred(req,res);
 let pathname=decodeURIComponent((req.url||"/").split("?")[0]);if(pathname==="/favicon.ico"){res.writeHead(204);return res.end();}if(pathname==="/")pathname="/index.html";
 const file=path.normalize(path.join(root,pathname));if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden");}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found");}res.writeHead(200,{"Content-Type":types[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data);});
});
server.listen(port,"0.0.0.0",()=>console.log("Dashboard running on "+port));