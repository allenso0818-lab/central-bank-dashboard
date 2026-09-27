const http=require("http"),https=require("https"),fs=require("fs"),path=require("path");
const port=Number(process.env.PORT||3000),root=__dirname;
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml"};
const cache=new Map();
function getHttps(url,cb,depth=0){
 if(depth>5)return cb(new Error("Too many redirects"));
 const r=https.get(url,{headers:{"User-Agent":"Mozilla/5.0 CentralBankDashboard/1.0","Accept":"text/csv,*/*"}},up=>{
  if(up.statusCode>=300&&up.statusCode<400&&up.headers.location){const next=new URL(up.headers.location,url).toString();up.resume();return getHttps(next,cb,depth+1);}
  if(up.statusCode!==200){up.resume();return cb(new Error("Upstream HTTP "+up.statusCode));}
  let chunks=[];up.on("data",x=>chunks.push(x));up.on("end",()=>cb(null,Buffer.concat(chunks)));
 });r.setTimeout(15000,()=>r.destroy(new Error("FRED timeout")));r.on("error",cb);
}
function fred(req,res){
 const u=new URL(req.url,"http://localhost"),id=(u.searchParams.get("id")||"").toUpperCase();
 if(!/^[A-Z0-9_-]{1,40}$/.test(id)){res.writeHead(400);return res.end("Invalid series");}
 const hit=cache.get(id);if(hit&&Date.now()-hit.time<1800000){res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Cache-Control":"public, max-age=1800"});return res.end(hit.data);}
 const target="https://fred.stlouisfed.org/graph/fredgraph.csv?id="+encodeURIComponent(id);
 getHttps(target,(err,data)=>{if(err){console.error("FRED",id,err.message);res.writeHead(502,{"Content-Type":"text/plain; charset=utf-8"});return res.end("FRED unavailable: "+err.message);}cache.set(id,{time:Date.now(),data});res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Cache-Control":"public, max-age=1800"});res.end(data);});
}
function refreshVerifiedDashboardHtml(html){return html
 .replace('Dashboard data verified: 25 Sep 2026 HKT','Dashboard data verified: 27 Sep 2026 HKT')
 .replace("plot:null,infl:2.2,latest:'FX Framework'","plot:null,infl:2.3,latest:'FX Framework'")
 .replace("mas:{measure:'Consumer Price Index – All Items, year-on-year',reference_period:'July 2026',publication_date:'24 Aug 2026',source_name:'Singapore Ministry of Trade and Industry / MAS',source_url:'https://www.mti.gov.sg/newsroom/consumer-price-developments-in-july-2026/'","mas:{measure:'Consumer Price Index – All Items, year-on-year',reference_period:'August 2026',publication_date:'23 Sep 2026',source_name:'Singapore Ministry of Trade and Industry / MAS',source_url:'https://www.mti.gov.sg/newsroom/consumer-price-developments-in-august-2026-/'")
 .replace("mas:[['2024-12',1.6],['2025-12',1.2],['2026-01',1.4],['2026-02',1.5],['2026-03',1.6],['2026-04',1.7],['2026-05',1.9],['2026-06',2.0],['2026-07',2.2]]","mas:[['2024-12',1.6],['2025-12',1.2],['2026-01',1.4],['2026-02',1.5],['2026-03',1.6],['2026-04',1.7],['2026-05',1.9],['2026-06',2.0],['2026-07',2.2],['2026-08',2.3]]");}
function fitComparisonMatrix(html){
 const css=`<style id="matrix-viewport-fit-v2">
.matrix-wrap{overflow-x:hidden!important;overflow-y:visible!important;width:100%!important;max-width:100%!important}
.matrix{width:100%!important;min-width:0!important;max-width:100%!important;table-layout:fixed!important;font-size:8px!important}
.matrix th,.matrix td{padding:4px 3px!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;hyphens:auto!important;min-width:0!important}
.matrix thead th:first-child,.matrix tbody th{width:13%!important;min-width:0!important}
.matrix thead th:not(:first-child),.matrix tbody td{width:12.43%!important;min-width:0!important}
.matrix img{max-width:100%!important}
.matrix .leader-profile,.matrix .leader{min-width:0!important;max-width:100%!important}
@media(max-width:1200px){.matrix{font-size:7px!important}.matrix th,.matrix td{padding:3px 2px!important;line-height:1.16!important}.matrix .muted{font-size:6.4px!important}.matrix .pill{font-size:6px!important;padding:1px 2px!important}}
</style>`;
 return html.includes('id="matrix-viewport-fit-v2"')?html:html.replace('</head>',css+'</head>');
}
const server=http.createServer((req,res)=>{
 if((req.url||"").startsWith("/api/fred?"))return fred(req,res);
 let pathname=decodeURIComponent((req.url||"/").split("?")[0]);if(pathname==="/favicon.ico"){res.writeHead(204);return res.end();}if(pathname==="/")pathname="/index.html";
 const file=path.normalize(path.join(root,pathname));if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden");}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});return res.end("Not found");}
  if(pathname==="/index.html")data=Buffer.from(fitComparisonMatrix(refreshVerifiedDashboardHtml(data.toString("utf8"))),"utf8");
  if(pathname==="/profiles/federal-reserve.html"){let html=data.toString("utf8");const tag='<script src="/profiles/fed-prediction-v2.js"></script>';if(!html.includes(tag))html=html.replace("</body>",tag+"</body>");data=Buffer.from(html,"utf8");}
  res.writeHead(200,{"Content-Type":types[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store, no-cache, must-revalidate"});res.end(data);
 });
});
server.listen(port,"0.0.0.0",()=>console.log("Dashboard running on "+port));